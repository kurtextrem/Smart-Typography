chrome.tabs.query({ active: true, currentWindow: true }, init);

function init(tabs) {
	var currentTab = tabs[0];
	var currentSwitchBtn;
	var currentUrl = currentTab.url;
	var currentDomain = "";

	// Extract domain from URL
	try {
		var url = new URL(currentUrl);
		currentDomain = url.hostname;
		document.getElementById("currentDomain").textContent = currentDomain;
	} catch (e) {
		// Hide disable options if URL is invalid (e.g., chrome:// pages)
		document.getElementById("disableOptions").style.display = "none";
	}

	// Setup disable options
	document.getElementById("disablePage").addEventListener("click", function () {
		chrome.runtime.sendMessage(
			{ action: "addExclusion", url: currentUrl },
			function (response) {
				if (response && response.success) {
					showReloadMessage();
				}
			},
		);
	});

	document
		.getElementById("disableDomain")
		.addEventListener("click", function () {
			chrome.runtime.sendMessage(
				{ action: "addExclusion", url: currentDomain },
				function (response) {
					if (response && response.success) {
						showReloadMessage();
					}
				},
			);
		});

	function showReloadMessage() {
		document.getElementById("disableOptions").style.display = "none";
		document.getElementById("reloadMessage").style.display = "block";
	}

	// Get constants from background script
	chrome.runtime.sendMessage({ action: "getConstants" }, function (response) {
		var BADGE = response.BADGE;
		var LANGUAGES = response.LANGUAGES;

		// Get the current badge text
		chrome.action.getBadgeText({ tabId: currentTab.id }, function (badgeText) {
			function setSwitchBtn(badgeTextParam) {
				currentSwitchBtn =
					badgeTextParam !== BADGE.OFF.TEXT ? BADGE.OFF : BADGE.ON;
				var otherStatusEl = document.getElementById("otherStatus");
				otherStatusEl.innerHTML = currentSwitchBtn.TEXT;
				otherStatusEl.style.backgroundColor = currentSwitchBtn.COLOR;
			}

			setSwitchBtn(badgeText);

			document.getElementById("switch").addEventListener("click", function (e) {
				chrome.runtime.sendMessage(
					{ action: "toggle", tab: currentTab },
					function (response) {
						if (response && response.badge) {
							dd(response.badge.TEXT);
							setSwitchBtn(response.badge.TEXT);
						}
						window.close();
					},
				);
			});

			var langList = document.getElementById("langList");

			var i = 0;
			for (; i < LANGUAGES.length; i++) {
				var li = document.createElement("li");
				li.appendChild(document.createTextNode(LANGUAGES[i].label));
				(function (index) {
					li.addEventListener("click", function (e) {
						switchLangTo(LANGUAGES[index]);
					});
				})(i);
				langList.appendChild(li);
			}

			function switchLangTo(lang) {
				chrome.runtime.sendMessage(
					{ action: "switchLangTo", lang: lang, tab: currentTab },
					function () {
						window.close();
					},
				);
			}
		});
	});
}

function dd(variable) {
	document.getElementById("dd").innerHTML = JSON.stringify(variable, null, 2);
}
