"use client"

import { animate } from "framer-motion"
import { useEffect, useState } from "react"

const delimiter = "" // Character-by-character animation

export function useAnimatedText(text: string) {
	const [cursor, setCursor] = useState(0)
	const [startingCursor, setStartingCursor] = useState(0)
	const [prevText, setPrevText] = useState(text)

	if (prevText !== text) {
		setPrevText(text)
		// Only continue from current cursor if new text is an extension of previous text
		setStartingCursor(text.startsWith(prevText) ? cursor : 0)
	}

	useEffect(() => {
		const textLength = text.split(delimiter).length

		// Skip animation if text is empty
		if (!textLength) return

		const controls = animate(startingCursor, textLength, {
			// Improved animation settings
			duration: Math.min(0.05 * textLength, 2), // Dynamic duration with a cap
			ease: "linear", // Smoother typing effect
			type: "tween", // Ensures consistent animation
			onUpdate(latest) {
				setCursor(Math.floor(latest))
			},
		})

		return () => controls.stop()
	}, [startingCursor, text])

	return text.split(delimiter).slice(0, cursor).join(delimiter)
}
