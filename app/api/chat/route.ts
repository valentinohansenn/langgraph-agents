import { NextResponse } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { DynamicTool } from "@langchain/core/tools"
import { TavilySearchResults } from "@langchain/community/tools/tavily_search"
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling"
import {
	ChatPromptTemplate,
	MessagesPlaceholder,
} from "@langchain/core/prompts"
import { RunnableSequence } from "@langchain/core/runnables"
import { AgentExecutor, type AgentStep } from "langchain/agents"
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad"
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser"
import {
	addMessages,
	entrypoint,
	MemorySaver,
	task,
} from "@langchain/langgraph"
import { createReactAgent } from "@langchain/langgraph/prebuilt"
import {
	AIMessage,
	BaseMessage,
	BaseMessageLike,
	HumanMessage,
} from "@langchain/core/messages"
import {
	getHotelRecommendations,
	getTravelRecommendations,
	transferToHotelAdvisor,
	transferToTravelAdvisor,
} from "@/lib/tool"

export const maxDuration = 30

const chatHistory: BaseMessage[] = []

const agentModel = new ChatOpenAI({
	model: "gpt-4-turbo",
	temperature: 0.4,
	streaming: true,
})

const agentTools = [new TavilySearchResults({ maxResults: 3 })]

const travelAdvisorTools = [getTravelRecommendations, transferToHotelAdvisor]

// Define travel advisor ReAct agent
const travelAdvisor = createReactAgent({
	llm: agentModel,
	tools: travelAdvisorTools,
	stateModifier: [
		"You are a general travel expert that can recommend travel destinations (e.g. countries, cities, etc).",
		"If you need hotel recommendations, ask 'hotel_advisor' for help.",
		"You MUST include human-readable response before transferring to another agent.",
	].join(" "),
})

// You can also add additional logic like changing the input to the agent / output from the agent, etc.
// NOTE: we're invoking the ReAct agent with the full history of messages in the state
const callTravelAdvisor = task(
	"callTravelAdvisor",
	async (messages: BaseMessageLike[]) => {
		const response = await travelAdvisor.invoke({ messages })
		return response.messages
	}
)

const hotelAdvisorTools = [getHotelRecommendations, transferToTravelAdvisor]

const agentCheckpointer = new MemorySaver()

// Define hotel advisor ReAct agent
const hotelAdvisor = createReactAgent({
	llm: agentModel,
	tools: hotelAdvisorTools,
	stateModifier: [
		"You are a hotel expert that can provide hotel recommendations for a given destination.",
		"If you need help picking travel destinations, ask 'travel_advisor' for help.",
		"You MUST include a human-readable response before transferring to another agent.",
	].join(" "),
	checkpointSaver: agentCheckpointer,
})

// Add task for hotel advisor
const callHotelAdvisor = task(
	"callHotelAdvisor",
	async (messages: BaseMessageLike[]) => {
		const response = await hotelAdvisor.invoke({ messages })
		return response.messages
	}
)

const networkGraph = entrypoint(
	"networkGraph",
	async (messages: BaseMessageLike[]) => {
		// Converts inputs to LangChain messages as a side-effect
		let currentMessages = addMessages([], messages)

		let callActiveAgent = callTravelAdvisor
		while (true) {
			const agentMessages = await callActiveAgent(currentMessages)
			currentMessages = addMessages(currentMessages, agentMessages)

			// Find the last AI message
			// If one of the handoff tools is called, the last message returned
			// by the agent will be a ToolMessage because we set them to have
			// "returnDirect: true". This means that the last AIMessage will
			// have tool calls.
			// Otherwise, the last returned message will be an AIMessage with
			// no tool calls, which means we are ready for new input.
			const aiMsg = [...agentMessages]
				.reverse()
				.find((m): m is AIMessage => m.getType() === "ai")

			// If no tool calls, we're done
			if (!aiMsg?.tool_calls?.length) {
				break
			}

			// Get the last tool call and determine next agent
			const toolCall = aiMsg.tool_calls.at(-1)!
			if (toolCall.name === "transferToTravelAdvisor") {
				callActiveAgent = callTravelAdvisor
			} else if (toolCall.name === "transferToHotelAdvisor") {
				callActiveAgent = callHotelAdvisor
			} else {
				throw new Error(`Expected transfer tool, got '${toolCall.name}'`)
			}
		}

		return messages
	}
)

export async function POST(req: Request) {
	const { message } = await req.json()

	if (!message) {
		return NextResponse.json(
			{ error: "Message is required" },
			{ status: 400 }
		)
	}

	chatHistory.push(new HumanMessage(message))

	try {
		const stream = await networkGraph.stream(chatHistory, { subgraphs: true })

		let aiMessages = []
		for await (const update of stream) {
			// Check if update contains AI message chunks
			if (update[1]?.callTravelAdvisor || update[1]?.callHotelAdvisor) {
				const messages =
					update[1]?.callTravelAdvisor || update[1]?.callHotelAdvisor
				// Find AIMessageChunk in the messages array
				const aiMessage = messages.find(
					(msg: { constructor: { name: string } }) =>
						msg.constructor.name === "AIMessageChunk"
				)
				if (aiMessage) {
					aiMessages.push(aiMessage.content)
				}
			}
		}

		chatHistory.push(new AIMessage(aiMessages[0]))

		return NextResponse.json({ output: aiMessages[0] })
	} catch (error) {
		console.error("Error:", error)
		return NextResponse.json(
			{ error: "An error occurred while processing your request" },
			{ status: 500 }
		)
	}
}

export async function GET() {
	return NextResponse.json({ chatHistory })
}
