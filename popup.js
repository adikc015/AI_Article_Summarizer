document.getElementById("summarize").addEventListener("click", () => {
  const resultDiv = document.getElementById("result");
  const summaryType = document.getElementById("summary-type").value;

  resultDiv.innerHTML = '<div class="loader"></div>';

  //Get the user's API key
  chrome.storage.sync.get(["geminiApiKey"], ({ geminiApiKey }) => {
    if (!geminiApiKey) {
      resultDiv.textContent = "No API key set. Click the gear icon to add one.";
      return;
    }

    //Ask content.js for the page text
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs || tabs.length === 0) {
        resultDiv.textContent = "No avtivbe tab found.";
        console.log("No active tabs found");
        return;
      }

      const tab = tabs[0];

      chrome.scripting.executeScript(
        {
          target: { tabId: tab.id },
          files: ["content.js"],
        },
        () => {
          chrome.tabs.sendMessage(
            tab.id,
            { type: "GET_ARTICLE_TEXT" },
            async (response) => {
              if (chrome.runtime.lastError) {
                console.error(
                  "SendMessage Error:",
                  chrome.runtime.lastError.message
                );
                resultDiv.textContent =
                  "Could not extract text from this page.";
                return;
              }

              if (!response || !response.text) {
                console.error("No response from content script!");
                resultDiv.textContent = "No article text found.";
                return;
              }

              //Send text to gemini
              try {
                const summary = await getGeminiSummary(
                  response.text,
                  summaryType,
                  geminiApiKey
                );
                resultDiv.textContent = summary;
              } catch (error) {
                resultDiv.textContent = "Gemini error: " + error.message;
              }
            }
          );
        }
      );
    });
  });
});

async function getGeminiSummary(rawText, type, apiKey) {
  const max = 20000;
  text = rawText.length > max ? rawText.slice(0, max) + "..." : rawText;

  const promptMap = {
    brief: `Summarise in 2-3 sentences:\n\n${text}`,
    detailed: `Give a detailed summary:\n\n${text}`,
    bullets: `Summarise in 5-7 bullet points (start each line with '-'):\n\n${text}`,
  };

  const prompt = promptMap[type] || promptMap.brief;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2 },
      }),
    }
  );

  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error?.message || "Request Failed");
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "No summary";
}

document.getElementById("copy-btn").addEventListener("click", () => {
  const txt = document.getElementById("result").innerText;
  if (!txt) return;

  navigator.clipboard.writeText(txt).then(() => {
    const btn = document.getElementById("copy-btn");
    const old = btn.textContent;
    btn.textContent = "Copied!";
    setTimeout(() => (btn.textContent = old), 2000);
  });
});
