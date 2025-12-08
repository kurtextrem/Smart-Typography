let excludedSites = [];

// Get languages from background script
chrome.runtime.sendMessage({ action: "getConstants" }, function (response) {
	const LANGUAGES = response.LANGUAGES;
	const select = document.getElementById("defaultLanguage");

	// Populate language dropdown
	LANGUAGES.forEach(function (lang) {
		const option = document.createElement("option");
		option.value = lang.code;
		option.textContent = lang.label;
		select.appendChild(option);
	});

	// Load saved settings
	chrome.storage.sync.get(
		[
			"defaultLanguage",
			"enableContextMenu",
			"sentenceBreakDash",
			"excludedSites",
		],
		function (data) {
			if (data.defaultLanguage) {
				select.value = data.defaultLanguage;
			}

			// Load context menu preference (default is enabled)
			const contextMenuCheckbox = document.getElementById("enableContextMenu");
			contextMenuCheckbox.checked = data.enableContextMenu !== false;

			// Load sentence break dash preference (default is em dash)
			const sentenceBreakDashSelect =
				document.getElementById("sentenceBreakDash");
			sentenceBreakDashSelect.value = data.sentenceBreakDash || "em";

			// Load excluded sites
			excludedSites = data.excludedSites || [];
			renderExclusionList();
		},
	);
});

// Render the exclusion list
function renderExclusionList() {
	const listContainer = document.getElementById("exclusionList");

	if (excludedSites.length === 0) {
		listContainer.innerHTML =
			'<div class="empty-state">No excluded sites</div>';
		return;
	}

	listContainer.innerHTML = "";
	excludedSites.forEach(function (site, index) {
		const item = document.createElement("div");
		item.className = "exclusion-item";

		const urlSpan = document.createElement("span");
		urlSpan.className = "exclusion-url";
		urlSpan.textContent = site;

		const removeBtn = document.createElement("button");
		removeBtn.className = "remove-btn";
		removeBtn.textContent = "Remove";
		removeBtn.onclick = function () {
			removeExclusion(index);
		};

		item.appendChild(urlSpan);
		item.appendChild(removeBtn);
		listContainer.appendChild(item);
	});
}

// Add exclusion
document.getElementById("addExclusion").addEventListener("click", function () {
	const input = document.getElementById("exclusionInput");
	const value = input.value.trim();

	if (!value) {
		return;
	}

	// Normalize the input (remove protocol if it's just a domain)
	let normalized = value.toLowerCase();

	// Check if already exists
	if (excludedSites.includes(normalized)) {
		alert("This site is already in the exclusion list.");
		return;
	}

	excludedSites.push(normalized);
	input.value = "";
	renderExclusionList();
	saveExcludedSites();
});

// Allow adding by pressing Enter
document
	.getElementById("exclusionInput")
	.addEventListener("keypress", function (e) {
		if (e.key === "Enter") {
			document.getElementById("addExclusion").click();
		}
	});

// Remove exclusion
function removeExclusion(index) {
	excludedSites.splice(index, 1);
	renderExclusionList();
	saveExcludedSites();
}

// Save excluded sites to storage
function saveExcludedSites() {
	chrome.storage.sync.set({ excludedSites: excludedSites }, function () {
		chrome.runtime.sendMessage({
			action: "updateExcludedSites",
			excludedSites: excludedSites,
		});
	});
}

// Save button handler
document.getElementById("save").addEventListener("click", function () {
	const select = document.getElementById("defaultLanguage");
	const defaultLanguage = select.value;
	const enableContextMenu =
		document.getElementById("enableContextMenu").checked;
	const sentenceBreakDash = document.getElementById("sentenceBreakDash").value;

	chrome.storage.sync.set(
		{
			defaultLanguage: defaultLanguage,
			enableContextMenu: enableContextMenu,
			sentenceBreakDash: sentenceBreakDash,
		},
		function () {
			// Show success message
			const status = document.getElementById("saveStatus");
			status.textContent = "Options saved successfully!";
			status.className = "save-status success";
			status.style.display = "block";

			// Hide message after 3 seconds
			setTimeout(function () {
				status.style.display = "none";
			}, 3000);

			// Notify background script to update settings
			chrome.runtime.sendMessage({
				action: "updateDefaultLanguage",
				language: defaultLanguage,
			});

			chrome.runtime.sendMessage({
				action: "updateContextMenu",
				enabled: enableContextMenu,
			});

			chrome.runtime.sendMessage({
				action: "updateSentenceBreakDash",
				sentenceBreakDash: sentenceBreakDash,
			});
		},
	);
});
