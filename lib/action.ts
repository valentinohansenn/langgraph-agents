function chunkText(text: string, chunkSize: number = 3) {
	const chunks = []

	for (let i = 0; i < text.length; i += chunkSize) {
		chunks.push(text.slice(i, i + chunkSize))
	}

	return chunks
}

export async function streamText(text: string) {
	const chunks = chunkText(text)

	async function* generateStream() {
		for (const chunk of chunks) {
			await new Promise((resolve) => setTimeout(resolve, Math.random() * 50))

			yield chunk
		}
	}

	return {
		textStream: generateStream(),
	}
}
