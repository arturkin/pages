1. Parse and structure the content first.
Use an HTML parser (BeautifulSoup in Python, or Cheerio/DOMParser in JS) to split the book into a structured dataset: chapters → sections → paragraphs, plus extract every image (road signs!) with its surrounding caption text. Store it as JSON or SQLite. Everything else builds on this, so make each chunk carry an ID, topic tag, and source reference so you can always jump back to the original text.

2. Auto-generate flashcards and quiz questions from the text.
This is where you get the biggest learning speedup. Two approaches, use both:

Rule-based extraction for the "number facts": regex/pattern-match sentences containing digits, units (km/h, m, ‰, mm), and keywords like "minimum," "maximum," "at least." These sentences convert almost mechanically into cloze-deletion cards ("The speed limit in urban areas is ___").
LLM-generated questions for conceptual material: feed each section to an LLM API and prompt it to return multiple-choice questions in strict JSON (question, 4 options, correct index, explanation, source section ID). Generate plausible wrong answers — that's what makes MCQs effective, and it mimics how real exams design distractors.

3. Implement spaced repetition as the core scheduler.
Don't reinvent this — implement the SM-2 algorithm (the classic Anki algorithm, ~40 lines of code) or use the newer FSRS library, which has open-source implementations in Python and JS. Each card stores ease factor, interval, and next-due date. The app's home screen is simply "here are your due cards today." This single feature is worth more than any UI polish.

4. Track errors and weight the question selection.
Log every answer (card ID, correct/wrong, timestamp, response time). Then bias your quiz mode to sample questions proportionally to your error rate per topic. A simple scoring like weight = 1 + 3 × recent_error_rate works fine. Add a dashboard showing accuracy per chapter so you can see your weak zones shrink — that feedback loop is genuinely motivating.

5. Build a mock-exam mode.
Same question pool, but: fixed question count matching the real exam, timed, no feedback until the end, and score against the real pass threshold. Store results over time. Your "ready" signal is several consecutive mocks comfortably above the threshold.

6. Special-case the road signs.
Extract all sign images from the HTML into an image-based card deck: show the sign → pick the meaning from 4 options, and the reverse. Deliberately group visually similar signs together as each other's wrong answers, since that's exactly what the exam tests.

Practical stack suggestions:

Fastest path: a single-page web app (plain JS or React) with everything client-side and progress saved in a local JSON/IndexedDB — no backend needed for a one-user app.
Even faster path: skip the app entirely for cards and just write a script that converts your HTML into an Anki deck (genanki library in Python). Anki already gives you spaced repetition, stats, and mobile apps for free — then you'd only build the mock-exam mode yourself.
If you want it in one evening: honestly, steps 1–2 as a Python script exporting to Anki, plus a simple HTML page for timed mock exams, covers 90% of the learning value.
