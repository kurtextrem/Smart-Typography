/*
 * Instant Smart Quotes by Florian Zemke, Regex by Muthu Kannan and Geoffrey Booth
 * Enhanced with features from Tipograph (https://github.com/pnevyk/tipograph)
 * https://github.com/Zemke/instant-smart-quotes
 *
 * Replace typewriter quotes, apostrophes, ellipses, dashes, and common symbols
 * with their typographically correct counterparts as you type.
 *
 * Features:
 * - Smart quotes (language-specific) with enhanced apostrophe handling
 * - Inch (″) and foot (′) unit symbols
 * - Em dashes (—) from three hyphens
 * - En dashes (–) from two hyphens, number ranges, or sentence breaks
 * - Ellipses (…) from three dots
 * - Multiple space normalization
 * - Copyright (©), trademark (™), and registered (®) symbols
 *
 * Wrap in backticks `"Thou shalt not use dumb quotes."` to ignore.
 * Also ignores triple-backtick ``` "code blocks" ```.
 */

var enabled;
var lang;
var sentenceBreakDash = "em"; // Default to em dash

var isTextField = function (elem) {
	return !!(
		elem.tagName.toUpperCase() === "TEXTAREA" ||
		elem.isContentEditable ||
		(elem.tagName.toUpperCase() === "INPUT" &&
			elem.type.toUpperCase() === "TEXT")
	);
};

var charsTillEndOfStr = function (activeElement) {
	return getValue(activeElement).length - getSelectionStart(activeElement);
};

var correctCaretPosition = function (activeElement, charsTillEndOfStr) {
	var correctCaretPos = getValue(activeElement).length - charsTillEndOfStr;
	setSelection(activeElement, correctCaretPos);
	return correctCaretPos;
};

var processTextField = function (activeElement) {
	var charsTillEnfOfStrBeforeRegex = charsTillEndOfStr(activeElement);
	var cursorPos = getSelectionStart(activeElement);
	var textValue = getValue(activeElement);
	setValue(
		activeElement,
		replaceTypewriterPunctuation(textValue, false, cursorPos),
	);
	correctCaretPosition(activeElement, charsTillEnfOfStrBeforeRegex);
	return getValue(activeElement);
};

var replaceTypewriterPunctuation = function (g, trimTrailingSpaces, cursorPos) {
	var splitterRegex =
		/(?:```[\S\s]*?(?:```|$))|(?:`[\S\s]*?(?:`|$))|(?:\{code(?:\:.*?)?\}[\S\s]*?(?:\{code\}|$))|(?:\{noformat\}[\S\s]*?(?:\{noformat\}|$))/gi;
	var f = false,
		d = "",
		h = g.split(splitterRegex);
	if (h.length === 1) {
		d = regex(g, trimTrailingSpaces, cursorPos);
	} else {
		var a = g.match(splitterRegex);
		if (!h[0]) {
			h.shift();
			f = true;
		}
		// Track cursor position across code blocks
		var currentPos = 0;
		for (var b = 0; b < h.length; ++b) {
			var segmentCursorPos = cursorPos != null && cursorPos >= currentPos && cursorPos < currentPos + h[b].length
				? cursorPos - currentPos
				: null;
			var c = regex(h[b], trimTrailingSpaces, segmentCursorPos);
			currentPos += h[b].length;
			if (a[b]) {
				currentPos += a[b].length;
			}
			if (f) {
				d += a[b] != null ? a[b] + c : c;
			} else {
				d += a[b] != null ? c + a[b] : c;
			}
		}
	}
	return d;
};

var regex = function (g, trimTrailingSpaces, cursorPos) {
	var result = g;

	// === ADVANCED SPACE HANDLING ===
	// Trim trailing whitespace at end of lines (only when explicitly requested)
	if (trimTrailingSpaces) {
		result = result.replace(/[ \t]+$/gm, "");
	}

	// Normalize multiple spaces to single space (but not at start of line to preserve indentation)
	// Allow double space at cursor position for better typing flow (e.g., "hello  world" when typing before existing space)
	if (cursorPos != null && cursorPos > 0 && cursorPos <= result.length) {
		// Check if cursor is positioned right after a space, with another space right after cursor
		var charBefore = result[cursorPos - 1];
		var charAfter = cursorPos < result.length ? result[cursorPos] : null;
		if ((charBefore === ' ' || charBefore === '\t') && (charAfter === ' ' || charAfter === '\t')) {
			// Preserve double space at cursor position, but normalize 3+ spaces elsewhere
			// Use a regex that skips the double space at cursor position
			result = result.replace(/(\S)([ \t]{2,})/g, function(match, nonSpace, spaces, offset) {
				// Check if cursor is within the space portion of this match
				var spaceStart = offset + nonSpace.length;
				var spaceEnd = offset + match.length;
				// If cursor is within the spaces and there are exactly 2 spaces, preserve them
				if (cursorPos >= spaceStart && cursorPos <= spaceEnd && spaces.length === 2) {
					return match; // Preserve double space at cursor
				}
				// Otherwise normalize to single space
				return nonSpace + ' ';
			});
		} else {
			// Normal case: normalize 2+ spaces
			result = result.replace(/(\S)[ \t]{2,}/g, "$1 ");
		}
	} else {
		// Normal case: normalize 2+ spaces
		result = result.replace(/(\S)[ \t]{2,}/g, "$1 ");
	}

	// Sentence break dash: " - " → " — " or " – " based on user preference
	// Requires word characters on BOTH sides to avoid matching list markers
	// e.g., "text - more" converts, but "- item" or "  - [x]" do NOT
	// Skip regex entirely if user chose to keep hyphens
	if (sentenceBreakDash === "em") {
		result = result.replace(/(\w) - (\w)/g, "$1 — $2");
	} else if (sentenceBreakDash === "en") {
		result = result.replace(/(\w) - (\w)/g, "$1 – $2");
	}

	return (
		result

			// === QUOTE ENHANCEMENTS ===
			// Fix double-comma quotes to proper bottom quotes (German/Czech style)
			.replace(/,,/g, "„")

			// Foot and inch symbols (must come before quote replacements)
			// 5'10" or 6' 2" style measurements
			.replace(/(\d+)\s*'\s*(\d+)\s*"/g, "$1′$2″")
			.replace(/(\d+)\s*'/g, "$1′")
			.replace(/(\d+)\s*"/g, "$1″")

			// Primary quotes (opening)
			.replace(
				new RegExp(
					"(\\s|^|\\(|\\>|\\])(" +
						lang.replacePrimary[0] +
						")(?=[^>\\]]*(<|\\[|$))",
					"g",
				),
				"$1" + lang.primary[0],
			)
			// Secondary quotes (opening)
			.replace(
				new RegExp(
					"(\\s|^|\\(|\\>|\\])(" +
						lang.replaceSecondary[0] +
						")(?=[^>\\]]*(<|\\[|$))",
					"g",
				),
				"$1" + lang.secondary[0],
			)
			// Primary quotes (closing)
			.replace(
				new RegExp(
					"(.)(" + lang.replacePrimary[1] + ")(?=[^>\\]]*(<|\\[|$))",
					"g",
				),
				"$1" + lang.primary[1],
			)
			// Secondary quotes (closing)
			.replace(
				new RegExp(
					"(.)(" + lang.replaceSecondary[1] + ")(?=[^>\\]]*(<|\\[|$))",
					"g",
				),
				"$1" + lang.secondary[1],
			)

			// === ADVANCED DASH/HYPHEN RULES ===
			// Three hyphens → em dash (requires word chars on both sides)
			.replace(/(\w)-{3}(\w)/g, "$1—$2")
			// Two hyphens → en dash (requires word chars on both sides)
			.replace(/(\w)-{2}(\w)/g, "$1–$2")
			// En dash + hyphen → em dash
			.replace(/(\w)–-(\w)/g, "$1—$2")

			// En dash for number ranges with optional spaces (1-5 or 2020-2024)
			.replace(/(\d+)\s*-\s*(\d+)/g, "$1–$2")

			// En dash for date ranges (January-March, Mon-Fri)
			.replace(/(\b[A-Z][a-z]{2,})\s*-\s*(\b[A-Z][a-z]{2,})/g, "$1–$2")

			// === ELLIPSIS ===
			.replace(/([^.…])\.{3}([^.…])/g, "$1…$2")
			// Handle ellipsis at start/end of string
			.replace(/^\.\.\./g, "…")
			.replace(/\.\.\.$/g, "…")

			// === SPECIAL SYMBOLS ===
			// Copyright, trademark, and registered symbols
			.replace(/\(c\)/gi, "©")
			.replace(/\(tm\)/gi, "™")
			.replace(/\(r\)/gi, "®")

			// === APOSTROPHE ENHANCEMENTS ===
			// Possessives and contractions (must come after quote replacements)
			// Common contractions
			.replace(
				/\b(don|won|can|couldn|wouldn|shouldn|didn|isn|aren|wasn|weren|hasn|haven|hadn)'t\b/gi,
				function (match) {
					return match.slice(0, -2) + "'t";
				},
			)
			.replace(
				/\b(I|you|we|they|he|she|it|who|what|there|here)'(ll|ve|re|d|m|s)\b/gi,
				function (match, word, suffix) {
					return word + "'" + suffix;
				},
			)

			// Shortenings whitelist
			.replace(/'([0-9]{2}s?)\b/gi, "'$1")
			.replace(/\b'(em)\b/gi, "'$1")
			.replace(/\b'(twas)\b/gi, "'$1")
			.replace(/\b'(cause)\b/gi, "'$1")
			.replace(/\b'(n)\b/gi, "'$1")
			.replace(/\b(rock|pop)'n'(roll)\b/gi, "$1'n'$2")

			// Possessive apostrophes (s' and s's)
			.replace(/([a-z])s'/gi, function (match, letter) {
				return letter + "s'";
			})
	);
};

var getValue = function (activeElement) {
	if (activeElement.isContentEditable) {
		return document.getSelection().anchorNode.textContent;
	}
	return activeElement.value;
};

var setValue = function (activeElement, newValue) {
	if (activeElement.isContentEditable) {
		var sel = document.getSelection();

		if (!isTextNode(sel.anchorNode)) {
			return;
		}

		return (sel.anchorNode.textContent = newValue);
	}
	return (activeElement.value = newValue);
};

var getSelectionStart = function (activeElement) {
	if (activeElement.isContentEditable) {
		return document.getSelection().anchorOffset;
	}
	return activeElement.selectionStart;
};

var setSelection = function (activeElement, correctCaretPos) {
	if (activeElement.isContentEditable) {
		var range = document.createRange();
		var sel = window.getSelection();

		if (!isTextNode(sel.anchorNode)) {
			var textNode = document.createTextNode("");
			sel.anchorNode.insertBefore(textNode, sel.anchorNode.childNodes[0]);
			range.setStart(textNode, 0);
		} else {
			range.setStart(sel.anchorNode, correctCaretPos);
		}

		range.collapse(true);
		sel.removeAllRanges();
		sel.addRange(range);
		return;
	}

	activeElement.selectionStart = correctCaretPos;
	activeElement.selectionEnd = correctCaretPos;
};

var isTextNode = function (node) {
	return node.nodeType === 3;
};

document.addEventListener(
	"input",
	(e) => {
		enabled &&
			!e.isComposing &&
			isTextField(e.target) &&
			processTextField(e.target);
	},
	true,
);

chrome.runtime.onMessage.addListener(function (req, sender, cb) {
	// Handle context menu format action
	if (req.action === "formatTypography") {
		formatTypography();
		if (cb) cb({ success: true });
		return true;
	}

	// Handle initialization
	enabled = req.enabled;
	lang = req.lang;
	if (req.sentenceBreakDash) {
		sentenceBreakDash = req.sentenceBreakDash;
	}
	cb({ location: req.location });
});

chrome.runtime.sendMessage({ question: "enabled" }, function (res) {
	enabled = res.enabled;
	lang = res.lang;
	if (res.sentenceBreakDash) {
		sentenceBreakDash = res.sentenceBreakDash;
	}
});

// Format entire field or selection via context menu
var formatTypography = function () {
	var activeElement = document.activeElement;

	if (!isTextField(activeElement)) {
		return;
	}

	if (activeElement.isContentEditable) {
		var sel = document.getSelection();
		if (!sel.rangeCount) return;

		var range = sel.getRangeAt(0);

		// If there's a selection, format only the selection
		if (!range.collapsed) {
			var selectedText = sel.toString();
			var formattedText = replaceTypewriterPunctuation(selectedText, true, null);

			range.deleteContents();
			var textNode = document.createTextNode(formattedText);
			range.insertNode(textNode);

			// Restore selection
			range.setStartAfter(textNode);
			range.collapse(true);
			sel.removeAllRanges();
			sel.addRange(range);
		} else {
			// Format entire contentEditable
			var originalText = activeElement.textContent;
			var formattedText = replaceTypewriterPunctuation(originalText, true, null);
			activeElement.textContent = formattedText;

			// Move cursor to end
			range.selectNodeContents(activeElement);
			range.collapse(false);
			sel.removeAllRanges();
			sel.addRange(range);
		}
	} else {
		// Handle textarea and input fields
		var start = activeElement.selectionStart;
		var end = activeElement.selectionEnd;
		var fullText = activeElement.value;

		// If there's a selection, format only the selection
		if (start !== end) {
			var beforeSelection = fullText.substring(0, start);
			var selectedText = fullText.substring(start, end);
			var afterSelection = fullText.substring(end);

			var formattedSelection = replaceTypewriterPunctuation(selectedText, true, null);
			activeElement.value =
				beforeSelection + formattedSelection + afterSelection;

			// Restore selection around formatted text
			var newEnd = start + formattedSelection.length;
			activeElement.setSelectionRange(start, newEnd);
		} else {
			// Format entire field
			var cursorPos = start;
			var formattedText = replaceTypewriterPunctuation(fullText, true, null);
			activeElement.value = formattedText;

			// Try to maintain relative cursor position
			var ratio = fullText.length > 0 ? cursorPos / fullText.length : 0;
			var newCursorPos = Math.round(formattedText.length * ratio);
			activeElement.setSelectionRange(newCursorPos, newCursorPos);
		}
	}

	// Trigger input event so other listeners know the content changed
	activeElement.dispatchEvent(new Event("input", { bubbles: true }));
};
