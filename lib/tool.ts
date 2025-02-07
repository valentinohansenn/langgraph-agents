import { tool } from "@langchain/core/tools"
import { z } from "zod"

// Tool for getting travel recommendations
export const getTravelRecommendations = tool(
	async () => {
		const destinations = ["aruba", "turks and caicos"]
		return destinations[Math.floor(Math.random() * destinations.length)]
	},
	{
		name: "getTravelRecommendations",
		description: "Get recommendation for travel destinations",
		schema: z.object({}),
	}
)

// Tool for getting hotel recommendations
export const getHotelRecommendations = tool(
	async (input: { location: "aruba" | "turks and caicos" }) => {
		const recommendations = {
			aruba: [
				"The Ritz-Carlton, Aruba (Palm Beach)",
				"Bucuti & Tara Beach Resort (Eagle Beach)",
			],
			"turks and caicos": ["Grace Bay Club", "COMO Parrot Cay"],
		}
		return recommendations[input.location]
	},
	{
		name: "getHotelRecommendations",
		description: "Get hotel recommendations for a given destination.",
		schema: z.object({
			location: z.enum(["aruba", "turks and caicos"]),
		}),
	}
)

// Define a tool to signal intent to hand off to a different agent
// Note: this is not using Command(goto) syntax for navigating to different agents:
// `workflow()` below handles the handoffs explicitly
export const transferToHotelAdvisor = tool(
	async () => {
		return "Successfully transferred to hotel advisor"
	},
	{
		name: "transferToHotelAdvisor",
		description: "Ask hotel advisor agent for help.",
		schema: z.object({}),
		// Hint to our agent implementation that it should stop
		// immediately after invoking this tool
		returnDirect: true,
	}
)

export const transferToTravelAdvisor = tool(
	async () => {
		return "Successfully transferred to travel advisor"
	},
	{
		name: "transferToTravelAdvisor",
		description: "Ask travel advisor agent for help.",
		schema: z.object({}),
		// Hint to our agent implementation that it should stop
		// immediately after invoking this tool
		returnDirect: true,
	}
)
