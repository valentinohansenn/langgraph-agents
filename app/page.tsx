"use client"

import { useRef, useEffect, useState } from "react"
import axios from "axios"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Bot, Loader2 } from "lucide-react"
import { useAnimatedText } from "@/hooks/use-animated-text"
import { streamText } from "@/lib/action"

interface Message {
	id: string
	content: string
	role: "user" | "assistant"
	isAnimated?: boolean
}

export default function Home() {
	const [mounted, setMounted] = useState<boolean>(false)
	const [messages, setMessages] = useState<Message[]>([])
	const [displayedText, setDisplayedText] = useState<string>("")
	const [input, setInput] = useState<string>("")
	const [isLoading, setIsLoading] = useState<boolean>(false)

	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const animatedText = useAnimatedText(displayedText)

	useEffect(() => {
		setMounted(true)
	}, [])

	useEffect(() => {
		const textarea = textareaRef.current
		if (textarea) {
			textarea.style.height = "auto"
			textarea.style.height = `${textarea.scrollHeight}px`
		}
	}, [input])

	if (!mounted) {
		return null
	}

	const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		setInput(e.target.value)
	}

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault()

		if (!input.trim()) return

		const query = input.trim()

		// Reset the input field
		setInput("")

		// Add user message
		setMessages((prevMessages) => [
			...prevMessages,
			{ id: Date.now().toString(), content: query, role: "user" },
		])

		// Add initial assistant message
		const assistantMessageId = (Date.now() + 1).toString()
		setMessages((prevMessages) => [
			...prevMessages,
			{
				id: assistantMessageId,
				content: "",
				role: "assistant",
				isAnimated: true,
			},
		])

		setIsLoading(true)
		setDisplayedText("")

		try {
			const response = await axios.post(
				"/api/chat",
				{ message: query },
				{ responseType: "text" }
			)

			console.log({ response })

			// Extract the output from the response
			const parsedResponse = JSON.parse(response.data)
			const res = parsedResponse.output

			const { textStream } = await streamText(res)

			let accumulator = ""
			for await (const textPart of textStream) {
				accumulator += textPart
				setDisplayedText(accumulator)
			}

			setTimeout(() => {
				setMessages((prevMessages) => {
					const lastMessage = prevMessages[prevMessages.length - 1]
					if (lastMessage && lastMessage.role === "assistant") {
						return prevMessages.map((msg) =>
							msg.id === lastMessage.id
								? { ...msg, content: accumulator, isAnimated: false }
								: msg
						)
					}
					return prevMessages
				})
			}, 1500)
		} catch (error) {
			console.error("Error:", error)
			setMessages((prevMessages) => {
				const lastMessage = prevMessages[prevMessages.length - 1]
				if (lastMessage && lastMessage.role === "assistant") {
					return prevMessages.map((msg) =>
						msg.id === lastMessage.id
							? {
									...msg,
									content: "An error occurred. Please try again.",
									isAnimated: false,
							  }
							: msg
					)
				}
				return prevMessages
			})
		} finally {
			setIsLoading(false)
			if (textareaRef.current) {
				textareaRef.current.style.height = "auto"
			}
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault()
			const form = e.currentTarget.form
			if (form) form.requestSubmit()
		}
	}

	return (
		<div className="flex flex-col h-screen bg-background">
			<div className="flex-1 overflow-y-auto p-4 space-y-4">
				{messages.map((message, index) => (
					<div
						key={message.id}
						className={`flex items-center gap-4 ${
							message.role === "user" ? "justify-end" : "justify-start"
						}`}
					>
						{message.role === "assistant" && (
							<div className="flex items-center rounded-full border border-primary p-2">
								<Bot className="h-5 w-5" />
							</div>
						)}

						<Card
							className={`max-w-[80%] p-4 rounded-3xl ${
								message.role === "user"
									? "bg-primary text-primary-foreground"
									: "bg-muted"
							}`}
						>
							{message.role === "assistant" &&
							message.isAnimated &&
							index === messages.length - 1 ? (
								<span key={`{message.id}-{message.content}`}>
									{animatedText}
								</span>
							) : (
								message.content
							)}
						</Card>
					</div>
				))}
			</div>

			<div className="border-t bg-background p-4">
				<form onSubmit={handleSubmit} className="flex gap-2 items-end">
					<div className="flex-1">
						<Textarea
							ref={textareaRef}
							value={input}
							onChange={handleInputChange}
							onKeyDown={handleKeyDown}
							placeholder="Type your message..."
							className="min-h-[44px] max-h-[200px] resize-auto"
							rows={1}
						/>
					</div>
					<Button
						type="submit"
						disabled={isLoading || !input.trim()}
						className="h-[44px]"
					>
						{isLoading ? <Loader2 className="animate-spin" /> : "Send"}
					</Button>
				</form>
			</div>
		</div>
	)
}
