# Replace "How it works" with "The visibility equation in the answer-engine era"

## What changes on the home page
The three-step "How it works" section is removed and replaced by a new section with one title and five cards, in Arabic, English and Kurdish.

Title: معادلة الظهور في عصر محركات الإجابة

Cards (your wording):
1. أزمة البحث الصفري (Zero-Click) — أكثر من 60% من عمليات البحث تنتهي دون نقرة واحدة؛ يكتفي المستخدم بإجابة الذكاء الاصطناعي.
2. خسارة الفرصة لصالح المنافس — صمت النماذج عن علامتك يدفعها لاقتراح البدائل المقتبسة في ذاكرتها.
3. كثافة الحقائق الموثقة — النماذج تبحث عن أرقام وبيانات واضحة في أول 100 كلمة، لا نصوص تسويقية عامة.
4. اتساق بطاقة الكيان — تطابق اسم علامتك وخدماتك وفروعك في سجلات الآلة وشبكات المعرفة دون تناقض.
5. خريطة الفجوات والمنافسين — كشف الكلمات والموضوعات التي اقتبست فيها النماذج منافسيك وغابت عنها علامتك.

Layout: responsive grid (3 cards on top row, 2 below on desktop; stacked on mobile), same gold/carbon card style already used on the page.

## Note on the 60% figure
Per the no-fabrication rule, the 60% statistic will be shown as you wrote it with a small source line ("Zero-click studies, SparkToro/Datos 2024"). If you prefer no source line, say so.

## Technical details
- File: src/components/landing/NewLanding.tsx only.
- Replace `how`, `s1`–`s3` keys in the ar/en/ku copy objects with `eqTitle` and `eq: [title, body][]` (5 items each).
- Replace the render block around line 321 with the new grid; no other sections, logic or routes touched.
- Verify with a screenshot in all three languages; no publishing without your approval.
