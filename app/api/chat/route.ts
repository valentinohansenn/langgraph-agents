import { NextResponse } from "next/server"
import { ChatOpenAI } from "@langchain/openai"
import { DynamicTool } from "@langchain/core/tools"
import { convertToOpenAIFunction } from "@langchain/core/utils/function_calling"
import {
	ChatPromptTemplate,
	MessagesPlaceholder,
} from "@langchain/core/prompts"
import { RunnableSequence } from "@langchain/core/runnables"
import { AgentExecutor, type AgentStep } from "langchain/agents"
import { formatToOpenAIFunctionMessages } from "langchain/agents/format_scratchpad"
import { OpenAIFunctionsAgentOutputParser } from "langchain/agents/openai/output_parser"
import { BaseMessage } from "@langchain/core/messages"

export const maxDuration = 30

const chatHistory: BaseMessage[] = []

const MEMORY_KEY = "chat_history"

const model = new ChatOpenAI({
	model: "gpt-4-turbo",
	temperature: 0.3,
	streaming: true,
})

const tool = new DynamicTool({
	name: "chat",
	description: "Chat with an AI",
	func: async () => {
		return "hello"
	},
})

const tools = [tool]

const prompt = ChatPromptTemplate.fromMessages([
	[
		"system",
		"You are very powerful and helpful assistant. Your task is to help me with my work, specifically in Typescript.",
	],
	new MessagesPlaceholder(MEMORY_KEY),
	["human", "{input}"],
	new MessagesPlaceholder("agent_scratchpad"),
])

const modelWithFunctions = model.bind({
	functions: tools.map((tool) => convertToOpenAIFunction(tool)),
})

const runnableAgent = RunnableSequence.from([
	{
		input: (i: { input: string; steps: AgentStep[] }) => i.input,
		agent_scratchpad: (i: { input: string; steps: AgentStep[] }) =>
			formatToOpenAIFunctionMessages(i.steps),
		chat_history: (i: {
			input: string
			steps: AgentStep[]
			chat_history?: BaseMessage[]
		}) => i.chat_history,
	},
	prompt,
	modelWithFunctions,
	new OpenAIFunctionsAgentOutputParser(),
])

const executor = AgentExecutor.fromAgentAndTools({
	agent: runnableAgent,
	tools,
})

export async function POST(req: Request) {
	const { message } = await req.json()

	if (!message) {
		return NextResponse.json(
			{ error: "Message is required" },
			{ status: 400 }
		)
	}

	try {
		const result = await executor.invoke({
			input: message,
			chat_history: chatHistory,
		})

		return NextResponse.json({ output: result.output })
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
