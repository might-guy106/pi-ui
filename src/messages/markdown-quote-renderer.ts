// Quotes without a border.
//
// pi-tui's blockquote case prefixes every line with theme.quoteBorder("│ "),
// which is why quotes used to arrive in the clipboard with a border character.
// This renders the same content — italic, quote colour, full width — as a
// full-width band instead.

import { Markdown, wrapTextWithAnsi } from "@earendil-works/pi-tui";

import { paintBand, resolveBandColor } from "../theme/block-band.ts";

const PATCHED = Symbol.for("pi-ui.markdown-quote-renderer.patched");

interface MarkdownLike {
	theme?: {
		quote?: (text: string) => string;
		italic?: (text: string) => string;
	};
	getStylePrefix?: (style: (text: string) => string) => string;
	renderToken: (token: any, width: number, nextTokenType?: string, styleContext?: any) => string[];
}

function styleQuoteText(component: MarkdownLike, text: string): string {
	const italic = component.theme?.italic;
	const quote = component.theme?.quote;
	const styled = typeof italic === "function" ? italic(text) : text;
	return typeof quote === "function" ? quote(styled) : styled;
}

export function installMarkdownQuoteRenderer(MarkdownClass: any = Markdown): void {
	const proto = MarkdownClass?.prototype;
	if (!proto || proto[PATCHED]) return;

	const baseRenderToken = proto.renderToken;
	if (typeof baseRenderToken !== "function") return;
	proto[PATCHED] = true;

	proto.renderToken = function patchedMarkdownQuoteRenderer(this: MarkdownLike, token: any, width: number, nextTokenType?: string, styleContext?: any): string[] {
		if (token?.type !== "blockquote") {
			return baseRenderToken.call(this, token, width, nextTokenType, styleContext);
		}

		const quoteStyle = (text: string) => styleQuoteText(this, text);
		const stylePrefix = typeof this.getStylePrefix === "function" ? this.getStylePrefix(quoteStyle) : "";
		const applyQuoteStyle = (line: string): string => {
			// Re-apply the quote style after nested resets so inline code and
			// emphasis inside a quote keep the quote's own color.
			const reapplied = stylePrefix ? line.replace(/\x1b\[0m/g, `\x1b[0m${stylePrefix}`) : line;
			return quoteStyle(reapplied);
		};
		// Blockquotes hold block-level tokens, and the message's default style
		// must not apply inside them.
		const quoteInlineStyleContext = { applyText: (text: string) => text, stylePrefix };
		const band = resolveBandColor(this.theme, "quoteBandBg", "cardBg", "customMessageBg");

		const renderedLines: string[] = [];
		const quoteTokens = token.tokens || [];
		for (let i = 0; i < quoteTokens.length; i++) {
			const quoteToken = quoteTokens[i];
			const nextQuoteToken = quoteTokens[i + 1];
			renderedLines.push(...this.renderToken(quoteToken, width, nextQuoteToken?.type, quoteInlineStyleContext));
		}
		// Avoid an empty band row where the outer block spacing takes over.
		while (renderedLines.length > 0 && renderedLines[renderedLines.length - 1] === "") {
			renderedLines.pop();
		}

		const lines: string[] = [];
		for (const quoteLine of renderedLines) {
			const styledLine = applyQuoteStyle(quoteLine);
			for (const wrappedLine of wrapTextWithAnsi(styledLine, width)) {
				lines.push(paintBand(this.theme, wrappedLine, width, band));
			}
		}

		if (nextTokenType && nextTokenType !== "space") {
			lines.push("");
		}
		return lines;
	};
}