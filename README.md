# 🔍 BiasLens AI

> **Empowering ethical AI development through automated bias detection and Gemini-powered insights.**

Developed for the **2026 Google Solution Challenge**. Built with React, Node.js, and **Google Gemini AI**.

---

## 🌍 UN Sustainable Development Goal

BiasLens AI is built to support **SDG 10: Reduced Inequalities**.

Algorithmic bias is a hidden driver of modern inequality. By providing an accessible, "neat and clean" tool to identify and mitigate bias in automated decision-making, we directly address **Target 10.3**: _"Ensure equal opportunity and reduce inequalities of outcome."_ We believe that making fairness audits easy for developers is a critical step toward a more equitable digital world.

---

## 📺 Demo

- **Live Demo:** [Insert Your Vercel/Live Link Here]
- **Video Walkthrough:** [Insert YouTube Link Here]

---

## 🛠️ Google Technology Stack

BiasLens AI is powered by the **Google AI ecosystem** to ensure high-performance, ethical analysis:

- **Google Gemini 1.5 Flash:** Our core AI engine, used via the Google AI SDK to generate contextual, grounded bias remediation strategies.
- **Google AI Studio:** Used extensively during development for prompt engineering, model temperature tuning, and "Instructional Grounding" to prevent AI hallucinations.
- **Google AI SDK for Node.js:** Seamless integration between our Express backend and Google's Large Language Models.

---

## 📸 Features

- **CSV Upload** — Drag-and-drop ingestion for rapid dataset auditing.
- **Auto-detection** — Intelligent scanning for sensitive columns (gender, race, age) and outcome variables.
- **Bias Score 0–100** — Instant classification into Low / Medium / High risk categories.
- **Visual Disparity Analysis** — Comparison bars showing outcome rates per demographic group.
- **Gemini AI Explanation** — Contextual analysis of _why_ bias exists and _how_ to fix it.
- **Actionable Remediation** — 6 specific, numbered steps to improve model fairness.

---

## ⚙️ How it Works

### 1. Statistical Analysis (The Engine)

The core logic in `biasAnalyzer.js` runs entirely in the browser for privacy. It calculates group outcome rates and flags any disparity exceeding the **20% threshold** (based on the Four-Fifths Rule / Disparate Impact Doctrine).

### 2. AI Grounding & Prototyping

Using **Google AI Studio**, we refined our system instructions to ensure the AI remains "grounded" in the provided data. The prompt is engineered to strictly use only the provided statistical summary and follows a rigid 3-part structure: **Bias Found**, **Why it's Harmful**, and **How to Fix it**.

### 3. Fail-Safe Implementation

The backend includes an automated fallback mechanism. If the environment restricts the newer Flash model, the system automatically switches to `gemini-pro` to ensure the user always receives a response.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- A free [Google Gemini API key from AI Studio](https://aistudio.google.com/app/apikey)

### Step 1 — Set up the Backend


cd backend
npm install
# Create a .env file and add your GEMINI_API_KEY
npm run dev

### Step 2 — Set up the Frontend

cd frontend
npm install
npm run dev

🧪 Sample Data
A sample dataset loan_approvals.csv is included in the sample-data/ folder. It contains intentional gender and race biases to demonstrate the tool's detection capabilities.

👥 Team HacksmithsAI
Anamika Meena - Lead Developer & Project Visionary
Anshika Sharma 
Bhavya Singh
Built with ❤️ for a fairer AI future using Google AI Studio.
```
