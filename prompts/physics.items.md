# Physics item authoring — BUILD only

This is an authoring instruction, not a runtime model call. It does not use `callLlm` and needs no runtime mock.

Read content/physics/README.md, graph.json and misconceptions.json first. Author original Class 10 physics practice questions using the Item schema in src/lib/content.ts. Output an array to bank.gen.json for review; never overwrite the reviewed bank automatically.

Each question needs a stable id, one or two existing conceptIds, difficulty 1–3, kind, stem, answer, explanation, reasoningPrompt asking why, diagnostic misconceptionTags, and markAllocation. MCQs need unique plausible options and the exact correct option text as answer. Specify units, idealisations and Cartesian signs. Difficulty 1 is recall/single step, 2 is interpretation/two steps, 3 combines ideas or counterfactual reasoning. Do not invent misconception tags: an empty tag list is appropriate when none of the closed taxonomy applies.

Produce small batches. Independently recompute numerical answers and check every distractor. Add reviewed items to bank.json only after verifying content and running npm run validate:content. Do not imply this five-chapter legacy practice scope equals a current board exam syllabus.
