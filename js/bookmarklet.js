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
var ignoredClasses = ["monaco"]; // Default ignored classes for input/textarea elements
var validMonthNames = []; // Will be populated with localized month names
var validDayNames = []; // Will be populated with localized day names

// Generate localized month and day names for date range validation
var generateValidDateNames = function () {
	if (!lang || !lang.code) return;

	var locale = lang.code.toLowerCase();
	validMonthNames = [];
	validDayNames = [];

	// Generate month names (full and short)
	for (var i = 0; i < 12; i++) {
		try {
			var date = new Date(2000, i, 1);
			validMonthNames.push(date.toLocaleDateString(locale, { month: "long" }));
			validMonthNames.push(date.toLocaleDateString(locale, { month: "short" }));
		} catch (e) {
			// Fallback for any locale issues
		}
	}

	// Generate day names (full and short)
	for (var i = 1; i <= 7; i++) {
		try {
			var date = new Date(2000, 0, i); // Sunday = 0, but we want Monday-Sunday
			validDayNames.push(date.toLocaleDateString(locale, { weekday: "long" }));
			validDayNames.push(date.toLocaleDateString(locale, { weekday: "short" }));
		} catch (e) {
			// Fallback for any locale issues
		}
	}
};

// Character codes for performance optimization (avoid string comparisons)
var SPACE_CHAR_CODE = 32; // space
var TAB_CHAR_CODE = 9; // \t
var NEWLINE_CHAR_CODE = 10; // \n
var CARRIAGE_RETURN_CHAR_CODE = 13; // \r

// Optimized whitespace checking function
var isWhitespace = function (charCode) {
	return (
		charCode === SPACE_CHAR_CODE ||
		charCode === TAB_CHAR_CODE ||
		charCode === NEWLINE_CHAR_CODE ||
		charCode === CARRIAGE_RETURN_CHAR_CODE
	);
};

var splitterRegex =
	/(?:```[\S\s]*?(?:```|$))|(?:`[\S\s]*?(?:`|$))|(?:\{code(?:\:.*?)?\}[\S\s]*?(?:\{code\}|$))|(?:\{noformat\}[\S\s]*?(?:\{noformat\}|$))/gi;

// Combined symbol replacement map for better performance
var symbolReplacements = {
	"(c)": "©",
	"(tm)": "™",
	"(r)": "®",
	"->": "→",
	"<-": "←",
};

var wordReplacements = {
	co2: "CO₂",
	h2o: "H₂O",
};

var symbolReplacementsRegex = /(?:\((?:c|tm|r)\)|[^-]->|<-)/gi;
var wordReplacementsRegex = /\b(?:co2|h2o)\b/gi;

// Optimized symbol replacement function
var applySymbolReplacements = function (text) {
	return text
		.replace(symbolReplacementsRegex, function (match) {
			return symbolReplacements[match.toLowerCase()] || match;
		})
		.replace(wordReplacementsRegex, function (match) {
			return wordReplacements[match.toLowerCase()] || match;
		});
};

var trailingSpacesRegex = /[ \t]+$/gm;
var multipleSpacesCursorRegex = /(\S)([ \t]{2,})/g;
var multipleSpacesRegex = /(\S)[ \t]{2,}/g;
var sentenceBreakDashRegex = /(\w) - (\w)/g;
var threeHyphensRegex = /(\w)-{3}(\w)/g;
var twoHyphensRegex = /(\w)-{2}(\w)/g;
var enDashHyphenRegex = /(\w)–-(\w)/g;
var numberRangeRegex = /(\d+)\s*-\s*(\d+)/g;
var dateRangeRegex = /(\b[A-Z][a-z]{2,})\s*-\s*(\b[A-Z][a-z]{2,})/g;
var ellipsisMiddleRegex = /([^.…])\.{3}([^.…])/g;
var ellipsisStartRegex = /^\.\.\./g;
var ellipsisEndRegex = /\.\.\.$/g;
var contractionsRegex =
	/\b(don|won|can|couldn|wouldn|shouldn|didn|isn|aren|wasn|weren|hasn|haven|hadn)'t\b/gi;
var iContractionsRegex =
	/\b(I|you|we|they|he|she|it|who|what|there|here)'(ll|ve|re|d|m|s)\b/gi;
// Combined apostrophe shortening patterns
var apostropheShorteningsRegex = /\b'(em|twas|cause|n|[0-9]{2}s?)\b/gi;
var rocknrollRegex = /\b(rock|pop)'n'(roll)\b/gi;

// Optimized apostrophe shortening replacement function
var applyApostropheShortenings = function (text) {
	return text
		.replace(apostropheShorteningsRegex, "'$1")
		.replace(rocknrollRegex, "$1'n'$2");
};
var possessiveRegex = /([a-z])s'/gi;
var doubleCommaRegex = /,,/g;
var measurementFeetInchesRegex = /(\d+)\s*'\s*(\d+)\s*"/g;
var feetSymbolRegex = /(\d+)\s*'/g;
var inchSymbolRegex = /(\d+)\s*"/g;

var disabledInputTypes = ["search"]

var isTextField = function (elem) {
	if (elem.isContentEditable) return true;

	var tagName = elem.tagName;
	if (tagName === "TEXTAREA") return true;

	if (tagName === "INPUT") {
		var inputType = elem.type.toLowerCase();
		return (inputType === "text" || inputType === "TEXT") && !disabledInputTypes.includes(inputType);
	}

	return false;
};

var hasIgnoredClass = function (elem) {
	if (!elem || !elem.className) return false;

	var classList = elem.className.split(" ");
	for (var i = 0; i < classList.length; i++) {
		const clx = classList[i];
		for (let ignoredClass of ignoredClasses) {
			if (clx.includes(ignoredClass)) {
				return true;
			}
		}
	}
	return false;
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
	// Cache DOM values to reduce repeated queries
	var textValue = getValue(activeElement);
	var cursorPos = getSelectionStart(activeElement);
	var charsTillEnd = textValue.length - cursorPos;

	var newValue = replaceTypewriterPunctuation(textValue, false, cursorPos);

	setValue(activeElement, newValue);
	correctCaretPosition(activeElement, charsTillEnd);

	return newValue;
};

var replaceTypewriterPunctuation = function (
	text,
	trimTrailingSpaces,
	cursorPos,
) {
	// Early return for simple cases without code blocks
	if (
		!text.includes("`") &&
		!text.includes("{code") &&
		!text.includes("{noformat")
	) {
		return regex(text, trimTrailingSpaces, cursorPos);
	}

	// Process complex cases with code blocks
	var parts = text.split(splitterRegex);
	var matches = text.match(splitterRegex) || [];

	// Pre-allocate result array for better performance
	var result = [];
	var currentPos = 0;
	var startsWithCodeBlock = !parts[0];

	if (startsWithCodeBlock) {
		parts.shift();
	}

	for (var i = 0; i < parts.length; i++) {
		// Calculate cursor position within this segment
		var segmentCursorPos = null;
		if (
			cursorPos != null &&
			cursorPos >= currentPos &&
			cursorPos < currentPos + parts[i].length
		) {
			segmentCursorPos = cursorPos - currentPos;
		}

		var processed = regex(parts[i], trimTrailingSpaces, segmentCursorPos);
		currentPos += parts[i].length;

		// Add processed segment and code block (if exists)
		if (startsWithCodeBlock) {
			result.push(matches[i] || "", processed);
		} else {
			result.push(processed, matches[i] || "");
		}

		if (matches[i]) {
			currentPos += matches[i].length;
		}
	}

	return result.join("");
};

var regex = function (g, trimTrailingSpaces, cursorPos) {
	var result = g;

	// === ADVANCED SPACE HANDLING ===
	// Trim trailing whitespace at end of lines (only when explicitly requested)
	if (trimTrailingSpaces) {
		result = result.replace(trailingSpacesRegex, "");
	}

	// Normalize multiple spaces to single space (but not at start of line to preserve indentation)
	// Allow double space at cursor position for better typing flow (e.g., "hello  world" when typing before existing space)
	if (cursorPos != null && cursorPos > 0 && cursorPos <= result.length) {
		// Check if cursor is positioned right after a space, with another space right after cursor
		var charBeforeCode = result.charCodeAt(cursorPos - 1);
		var charAfterCode =
			cursorPos < result.length ? result.charCodeAt(cursorPos) : -1;
		if (
			(charBeforeCode === SPACE_CHAR_CODE ||
				charBeforeCode === TAB_CHAR_CODE) &&
			(charAfterCode === SPACE_CHAR_CODE || charAfterCode === TAB_CHAR_CODE)
		) {
			// Preserve double space at cursor position, but normalize 3+ spaces elsewhere
			// Use a regex that skips the double space at cursor position
			result = result.replace(
				multipleSpacesCursorRegex,
				function (match, nonSpace, spaces, offset) {
					// Check if cursor is within the space portion of this match
					var spaceStart = offset + nonSpace.length;
					var spaceEnd = offset + match.length;
					// If cursor is within the spaces and there are exactly 2 spaces, preserve them
					if (
						cursorPos >= spaceStart &&
						cursorPos <= spaceEnd &&
						spaces.length === 2
					) {
						return match; // Preserve double space at cursor
					}
					// Otherwise normalize to single space
					return nonSpace + " ";
				},
			);
		} else {
			// Normal case: normalize 2+ spaces
			result = result.replace(multipleSpacesRegex, "$1 ");
		}
	} else {
		// Normal case: normalize 2+ spaces
		result = result.replace(multipleSpacesRegex, "$1 ");
	}

	// Sentence break dash: " - " → " — " or " – " based on user preference
	// Requires word characters on BOTH sides to avoid matching list markers
	// e.g., "text - more" converts, but "- item" or "  - [x]" do NOT
	// Skip regex entirely if user chose to keep hyphens
	if (sentenceBreakDash === "em") {
		result = result.replace(sentenceBreakDashRegex, "$1 — $2");
	} else if (sentenceBreakDash === "en") {
		result = result.replace(sentenceBreakDashRegex, "$1 – $2");
	}

	// Apply all optimized replacements
	result = applySymbolReplacements(result);
	result = applyApostropheShortenings(result);

	return (
		result

			// === QUOTE ENHANCEMENTS ===
			// Fix double-comma quotes to proper bottom quotes (German/Czech style)
			.replace(doubleCommaRegex, "„")

			// Foot and inch symbols (must come before quote replacements)
			// 5'10" or 6' 2" style measurements
			.replace(measurementFeetInchesRegex, "$1′$2″")
			.replace(feetSymbolRegex, "$1′")
			.replace(inchSymbolRegex, "$1″")

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
			.replace(threeHyphensRegex, "$1—$2")
			// Two hyphens → en dash (requires word chars on both sides)
			.replace(twoHyphensRegex, "$1–$2")
			// En dash + hyphen → em dash
			.replace(enDashHyphenRegex, "$1—$2")

			// En dash for number ranges with optional spaces (1-5 or 2020-2024)
			.replace(numberRangeRegex, "$1–$2")

			// En dash for date ranges (January-March, Mon-Fri)
			.replace(dateRangeRegex, function (match, word1, word2) {
				// Only replace if both words are valid month or day names
				if (
					validMonthNames.includes(word1) &&
					validMonthNames.includes(word2)
				) {
					return word1 + "–" + word2;
				}
				if (validDayNames.includes(word1) && validDayNames.includes(word2)) {
					return word1 + "–" + word2;
				}
				// If not valid date names, return the original match unchanged
				return match;
			})

			// === ELLIPSIS ===
			.replace(ellipsisMiddleRegex, "$1…$2")
			// Handle ellipsis at start/end of string
			.replace(ellipsisStartRegex, "…")
			.replace(ellipsisEndRegex, "…")

			// === APOSTROPHE ENHANCEMENTS ===
			// Possessives and contractions (must come after quote replacements)
			// Common contractions
			.replace(contractionsRegex, function (match) {
				return match.slice(0, -2) + "'t";
			})
			.replace(iContractionsRegex, function (match, word, suffix) {
				return word + "'" + suffix;
			})

			// Possessive apostrophes (s' and s's)
			.replace(possessiveRegex, function (match, letter) {
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
			!hasIgnoredClass(e.target) &&
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
	generateValidDateNames(); // Generate localized month/day names
	if (req.sentenceBreakDash) {
		sentenceBreakDash = req.sentenceBreakDash;
	}
	if (req.ignoredClasses) {
		ignoredClasses = req.ignoredClasses;
	}
	cb({ location: req.location });
});

chrome.runtime.sendMessage({ question: "enabled" }, function (res) {
	enabled = res.enabled;
	lang = res.lang;
	generateValidDateNames(); // Generate localized month/day names
	if (res.sentenceBreakDash) {
		sentenceBreakDash = res.sentenceBreakDash;
	}
	if (res.ignoredClasses) {
		ignoredClasses = res.ignoredClasses;
	}
});

// Format entire field or selection via context menu
var formatTypography = function () {
	var activeElement = document.activeElement;

	if (!isTextField(activeElement) || hasIgnoredClass(activeElement)) {
		return;
	}

	if (activeElement.isContentEditable) {
		var sel = document.getSelection();
		if (!sel.rangeCount) return;

		var range = sel.getRangeAt(0);

		// If there's a selection, format only the selection
		if (!range.collapsed) {
			var selectedText = sel.toString();
			var formattedText = replaceTypewriterPunctuation(
				selectedText,
				true,
				null,
			);

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
			var formattedText = replaceTypewriterPunctuation(
				originalText,
				true,
				null,
			);
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

			var formattedSelection = replaceTypewriterPunctuation(
				selectedText,
				true,
				null,
			);
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
