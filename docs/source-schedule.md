# COS330 — SHARED STUDY SCHEDULE (KYLE & DAVID) — VERSION 3

Final exam: Saturday 21 November 2026, 15:00–18:00 · Version 3 revised Thursday 12 November 2026 · Status: **READY FOR SHARED PROJECT CONTEXT — adjust against actual progress**

**How to use this file in a Claude conversation.** This document is a planning baseline, not an automatic record of completed studying. Ask "What should Kyle study today?", "What should David do next?", "What is our next joint session about?", "Which chapters are not covered yet?", "What do we practise together?" or "We missed a day, adjust the plan." Claude answers from Sections 5–9 and 11, and updates Sections 13–15 only from what you report. Nothing is marked done unless you say so.

**Evidence labels.** *Verified* = taken from the course files (slide counts, slide numbers, practicals). *Estimate* = my planning guess (hours, pace, complexity). *Assumption* = something I had to assume about you or about the material. Section 4 keeps these apart. **MUST/SHOULD/COULD describe time-allocation priorities, never examination likelihood or exclusions; all prescribed slides remain examinable.**

---

## 1. EXAMINATION OVERVIEW

| Item | Detail | Source |
|---|---|---|
| Module | COS330 Computer Security, University of Pretoria, Prof Venter | announcement |
| Date and time | Saturday 21 Nov 2026, 15:00–18:00 (3 h) | announcement |
| Marks | 100. Pace in the semester test was about 1.8 min per mark (a 10-mark item ≈ 18 min) | announcement; test |
| Scope | Chapters 1–11 and 13. **Chapter 12 excluded.** | announcement |
| Format | "Very similar to the semester test": ClickUP, closed book | announcement; CH13 S45 |
| Venue | Informatorium Orange and CBT labs. Arrive 14:30. No preseating. | announcement |
| Marks rule | Final mark = 50% semester + 50% exam; exam sub-minimum 40% | CH13 S45 |

**What the semester test is used for here:** the lecturer's question types, wording, answer depth, mark allocation and the mix of theory and practical items. It is **not** used to rank chapters or to decide anyone's strengths and weaknesses.

---

## 2. CORRECTED STARTING ASSUMPTIONS (VERSION 2)

1. **Today (Thu 12 Nov) is a no-study day.** The schedule starts on **Fri 13 Nov**.
2. **Both Kyle and David relearn all twelve examinable chapters from close to zero.** Ch 1–5 are not revision. The only difference between them is available time.
3. The previous test was largely a past paper they had prepared for. **Test results are ignored when planning.** No chapter gets more or less time because of it, and no topic is labelled a personal weakness. Difficulties are recorded only when a student reports them (Section 14).
4. **Kyle:** about 4–6 focused hours on a normal study day (plan uses 5.5 h; **Estimate**). One full golf/rest day is protected (Section 8).
5. **David:** the other exam on **Wed 18 Nov** comes first. His COS330 hours before then are small and flexible (the 1–1.5 h daily suggestions are **assumptions**, not commitments). He may move ahead into Ch 6–13 whenever time permits instead of being confined to Ch 1–5. Thu 19 adapts to his *actual* queue position.
6. Thu 19 Nov is the major joint day. **Fri 20 Nov is practice and revision only.** Sat 21 Nov is the exam.
7. The course knowledge map is a factual index and is **not changed** by this rebuild. Its priority section (Knowledge Map Section 7) leaned on the test, so **this schedule does not use it**.
8. No progress has been reported so far, so every status below is "Not started".

---

## 3. CHAPTER ORDER AND WHY

### 3.1 Final order (your preference, kept, with one structural change)

| Step | Chapters | Reason (from the course material) |
|---|---|---|
| 1 | **Ch 1–2** Fundamentals and cryptography | Ch 1 gives the vocabulary used in every later chapter (CIA, threat, vulnerability, attack, countermeasure). Ch 2 supplies hashes, signatures and certificates that Ch 3, 4 and 8 reuse (Ch 2 S26 lists passwords and intrusion detection as hash uses). |
| 2 | **Ch 3–4** Authentication and access control | The lecturer's own summary slide (CH4 S3) calls identification and authentication the first fine-grained service and access control the second. |
| 3 | **Ch 5** Database and data centre security | Uses Ch 4 (DAC, RBAC, GRANT/REVOKE) and introduces SQL injection, which Ch 11 reuses (CH11 S15). |
| 4 | **Ch 6–7** Malware and denial of service | Bots and zombies (Ch 6 S43–44) are the machines behind DDoS (Ch 7 S12–13). |
| 5 | **Ch 8–9** Intrusion detection, firewalls and IPS | IPS is "an extension of an IDS" (CH9 S29), and Snort appears in both. Together they cover how to detect and block the attacks of Ch 6–7. |
| 6 | **Ch 10–11** Buffer overflow and software security | Ch 11 builds on Ch 10 (input size, numeric validation) and Ch 5 (injection). |
| 7 | **Ch 13** Cloud and IoT | Most self-contained chapter. It touches Ch 4 only through identity and access management (Table 13.2). |

### 3.2 Why this order is a default, not a lockstep requirement

- Follow the sequence when learning a topic for the first time, particularly for Ch 1→5 and within the related pairs 6–7, 8–9 and 10–11.
- Kyle and David may move through the same sequence at different speeds. A joint discussion is scheduled only for material **both have prepared**, or it is explicitly labelled an introductory overview.
- If a chapter takes longer than its estimate, use the fallback policy in Section 11; do not falsely record completion.

### 3.3 Structural changes and why

- **Chapters are split across days where needed.** Ch 5, Ch 9 and Ch 11 each span two days because a whole chapter does not fit neatly into one 5.5-hour day. The order is unchanged.
- **Ch 13 sits on Thursday morning.** That is the tail of your order, not a move. It is the chapter least likely to suffer from having little time to revisit, because it is mostly tables, lists and descriptions.
- **Spaced revisits are added for the technical mechanisms** so they are not studied once and left: the transposition, the revocation graph, the TCP handshake, the packet-filter rules, the hex stack trace and the 8-bit example each come back in a Thursday or Friday drill (Sections 9 and 12).

### 3.4 Alternative considered and rejected

Putting Ch 10–11 (the hand-trace chapters) before Ch 6–9 would give them more revisit time. I kept your order because it preserves the attack → detect → prevent pairing of Ch 6–9 and because Ch 11 reuses Ch 5 and Ch 10. The revisit slots above cover most of the benefit.

---

## 4. WORKLOAD FEASIBILITY ASSESSMENT

### 4.1 What is verified and what is estimated

**Verified facts** (from the course files): slide counts per chapter (520 in total), which chapters contain a practical (Ch 2, 3, 4, 5, 6, 8, 10), and which technical examples exist on the slides (Knowledge Map Section 4). Several table slides are stored as images and must be opened by hand (Knowledge Map 9.3).

**Estimates** (mine): the model below. Slides are not divided by one reading speed. Each chapter's time is:

> understanding time = slides × 3 min × complexity factor
> + explicit minutes for its technical examples
> + 25% for active recall

| Complexity factor | Used for |
|---|---|
| 1.0 | Descriptive chapters (Ch 1, Ch 13) |
| 1.25 | Mixed: definitions plus some mechanisms (Ch 3, 4, 6, 7, 8) |
| 1.5 | Procedure or calculation heavy (Ch 2, 5, 9, 10, 11) |

"Full depth" means every slide and every worked example learned, with recall. The three tiers are defined in Section 10.

### 4.2 Workload per chapter (Kyle)

| Ch | Slides | Complexity | Technical-example minutes | Full depth (h) | MUST (h) | SHOULD (h) |
|---|---|---|---|---|---|---|
| 1 | 41 | 1.0 | 20 | 3.0 | 1.5 | 1.5 |
| 2 | 47 | 1.5 | 70 | 5.75 | 3.0 | 2.75 |
| 3 | 36 | 1.25 | 20 | 3.25 | 1.5 | 1.75 |
| 4 | 50 | 1.25 | 40 | 4.75 | 2.25 | 2.5 |
| 5 | 47 | 1.5 | 70 | 5.75 | 3.0 | 2.75 |
| 6 | 59 | 1.25 | 25 | 5.25 | 2.75 | 2.5 |
| 7 | 24 | 1.25 | 20 | 2.25 | 1.25 | 1.0 |
| 8 | 46 | 1.25 | 35 | 4.25 | 2.25 | 2.0 |
| 9 | 41 | 1.5 | 40 | 4.75 | 2.5 | 2.25 |
| 10 | 40 | 1.5 | 40 | 4.5 | 2.5 | 2.0 |
| 11 | 43 | 1.5 | 35 | 4.75 | 2.5 | 2.25 |
| 13 | 46 | 1.0 | 20 | 3.25 | 1.75 | 1.5 |
| **Total** | **520** | | | **51.5** | **26.75** | **24.75** |

Sensitivity check: if study takes **25% longer per unit of material**, full depth is approximately **64.4 h**; if it takes **25% less time**, approximately **38.6 h**. If "25% faster" instead means processing 1.25× as much material per hour, full depth takes **41.2 h**. These are modelling scenarios, not measured study speeds.

### 4.3 Hours available, with independent and joint time separated

| Person / period | Independent active study | Joint active study | Breaks / elapsed | Important qualification |
|---|---:|---:|---|---|
| **Kyle, Fri 13–Wed 18** (Fri, Sun–Wed; golf Sat) | 27.5 h planned (5 × 5.5 h), range 20–30 h at 4–6 h/day | Up to 2 h 10 min of *optional* early discussions (J1–J4), usually replaces SHOULD time | Independent blocks exclude ordinary short breaks | No COS330 Thu 12 or Sat 14 |
| **Kyle, Thu 19** | 5.25 h | 2.5 h | **7 h 45 min active**, ~9 h elapsed including 1 h 15 min breaks | This is a long day, not an ordinary 5.25 h study day; shorten optional deepening if tired |
| **David, Fri 13–Tue 17** | 5.5 h of *suggested* minimum sessions, including 0.5 h recall; optional additional sessions are not guaranteed | Early sessions optional and not a substitute for first reading | Actual availability unknown | His other examination takes priority |
| **David, Wed 18** | 0 required; optional 1–1.5 h after his exam *only if rested* | Optional meeting | Actual availability unknown | No daytime COS330 |
| **David, Thu 19** | 5.25 h | 2.5 h | **7 h 45 min active**, ~9 h elapsed | Independent blocks cannot cover 6.5 h of originally allocated queue tasks at full MV depth |
| **Both, Fri 20** | ~4 h 15 min individual work incl. mock, drills and targeted recall | 1 h 45 min joint marking and quiz | **6 h active**, ~6 h 50 min elapsed incl. breaks | Practice/revision only |

**Arithmetic / capacity audit:** Kyle has **32.75 h independent** planned through Thu 19 (27.5 + 5.25), **plus** up to 2.5 h joint on Thu 19; never add joint time to the 32.75 h figure and then describe it as independent. David's complete Q1–Q16 queue is **13.25 h of independent first-pass tasks**; the Thu 19 allocations to Q10–Q16 alone total **6.5 h**, not 5.25 h. To fit his Thursday, some tasks must genuinely be shortened or completed earlier. Joint teach-backs reinforce material but **do not replace the original first-pass time**. See Section 9.3.

### 4.4 What this means

**Kyle.** Full depth (51.5 h) cannot fit into 32.75 h of independent preparation. The MUST tier (26.75 h) fits on paper and leaves about 6 h of independent time for selected SHOULD tasks or recovery. This is **breadth-first essential coverage**, not mastery of every prescribed detail. Actual pace and demonstrated recall determine whether that coverage is achieved. Thu 19 requires 7 h 45 min active including the joint session, so its SHOULD portion is expendable.

**David.** The 13.25 h queue is an aggressive minimum-viable *independent* target, not full learning. The required pre-18 suggestions (5.5 h, including recall) + 5.25 h Thu give **10.75 h active independent**, leaving at least **2.5 h of shortfall** before considering the effect of recall and topic splits. Optional earlier work is therefore **needed**, not merely a bonus, to complete all original MV queue items; if it does not happen, Section 9.3 and Scenario D provide honest reduced-depth alternatives. Do not state David has completed all chapters at MV depth if he has only seen them at exposure level.

**Shared trade-off.** The exam scope does not shrink when study time is shortened. Every Ch 1–11 and 13 slide remains eligible, even if time forces a faster or shallower pass. The plan's tiers allocate scarce time; they do **not** predict examinability.

## 5. CHRONOLOGICAL SCHEDULE — OVERVIEW

Thu 12 Nov: no study (agreed). Details are in Sections 6 (Kyle), 7 (David) and 9 (joint). **M** = MUST, **S** = SHOULD, **C** = COULD.

| Date | Kyle's study | David's study | Joint session | Main goal |
|---|---|---|---|---|
| **Fri 13** | Ch 1, Ch 2 (M 4.5 h, S 1.0 h) | Ch 1, Ch 2 part A (M 1.5 h) | None | Foundations and cryptography learned |
| **Sat 14** | 🏌️ **PROTECTED GOLF / REST DAY. No study.** | No COS330 required (S 1.0 h optional: Ch 2 part B, only if free) | **None** | Rest |
| **Sun 15** | Ch 3, Ch 4, Ch 5 part A (M 4.5 h, S 1.0 h) | Ch 3, Ch 4 part A (M 1.5 h) | J1 optional, ≤30 min: Ch 1–2 | Authentication and access control learned |
| **Mon 16** | Ch 5 part B, Ch 6 (M 5.0 h, S 0.5 h) | Ch 4 part B, Ch 5 part A (M 1.5 h) | J2 optional, ≤40 min: Ch 3–4 | Database security and malware learned |
| **Tue 17** | Ch 7, Ch 8, Ch 9 part A (M 4.75 h, S 0.75 h) | Ch 5 part B (M 1.0 h, light) | J3 optional, ≤30 min: Ch 5 | DoS, IDS, first half of firewalls |
| **Wed 18** | Ch 9 part B, Ch 10, Ch 11 part A (M 5.0 h, S 0.5 h) | **Other exam. No COS330 by day.** Evening S 1.5 h optional: Ch 6 part A | J4 optional, ≤30 min after his exam | Buffer overflow and input handling learned |
| **Thu 19** | Ch 11 part B, Ch 13, then deepening (M 3.0 h, S 2.25 h) | Next outstanding queue items first; target Ch 6–13 with MV/exposure mix (5.25 h independent; conditional Section 9.3) | **J5: main joint day** (≈2.5 h joint; ≈9 h elapsed with breaks) | Kyle aims for MUST coverage of all chapters; David records actual MV/exposure/untouched chapters, no assumed completion |
| **Fri 20** | **Practice and revision only** (≈6 h, ≈7 h with breaks) | Same | **J6** marking and rapid-fire | Mock, marking, active recall |
| **Sat 21** | 60–75 min light revision, finished by midday | Same | J7 optional, ≤20 min | Rested, arrive 14:30, exam 15:00 |

---

## 6. KYLE'S DETAILED DAILY ASSIGNMENTS

How tasks are tagged: **MUST** = essential concepts, first-pass learning and key technical example. **SHOULD** = extra detail and consolidation. **COULD** = optional extension. Hours are estimates. Each day's **SHOULD slot doubles as the catch-up block**: if you are behind, spend it on unfinished MUST items first. Slide numbers are from the course files.

### Fri 13 Nov — Ch 1 and Ch 2 (target 5.5 h, range 4–6)

- **MUST** Ch 1: S4–7 (definition, CIA, impact levels), S10–15 (terminology, assets, vulnerabilities, threats, attacks, countermeasures), S21–22 (Table 1.3, passive vs active attacks), S34 (learn the names of the 13 design principles), S35–36 (attack surfaces). *Example:* fill a CIA table with Low/Moderate/High and a reason for one system you choose. — 1.5 h
- **MUST** Ch 2: S3–8 (symmetric encryption and attacks), S9–13 (DES, 3DES, AES; Tables 2.1 and 2.2), S17 (block vs stream), S18–26 (message authentication, MAC, hash properties), S27–35 (public-key encryption), S36–38 (digital signatures), and **Practical 1** (S46–47): do one complete double columnar transposition, decrypting with the second key first. The ST1 Q4 marked solution is a worked example: attempt first, then compare. — 3.0 h
- **SHOULD** Ch 2: S14–16, S22–24 (figures), S39–44 (certificates, digital envelopes, random numbers, stored-data encryption), a second timed transposition run. — 1.0 h
- **COULD** Ch 1: S8–9 (ten challenges), S16–19 (Table 1.2, open the images), S23–33 (17 FIPS families). — 0.5 h
- **Outcome:** can explain CIA and the threat vocabulary; can compare symmetric, public-key, hash, MAC and signature; can run the transposition.

### Sat 14 Nov — 🏌️ PROTECTED GOLF / REST DAY

No study. See Section 8.

### Sun 15 Nov — Ch 3, Ch 4 and the start of Ch 5 (target 5.5 h)

- **MUST** Ch 3: S3–5 (definition, four means), S7–11 (assurance levels; open the S11 image for Table 3.2), S12–15 (eight password attacks, UNIX password scheme, salt, rainbow tables), S19–20 (selection strategies, proactive checking), S22–24 (memory cards, smart tokens, smart cards), S28–30 (biometrics). *Example:* judge five passwords of your own choosing and give a reason for each. — 1.5 h
- **MUST** Ch 4: S4–6, S11–13 (DAC, MAC, RBAC, ABAC; subjects, objects, rights; access matrix), S14–15 (ACL vs capability list), S18–21 (UNIX permissions and ACLs), S23–24 (RBAC), S25–28 (ABAC), S29–35 (ICAM overview). *Example:* read a UNIX permission string; build an ACL and a capability list from a small matrix. — 2.25 h
- **MUST** Ch 5 part A: S3–16 (why databases are hard to secure, relational background, SQL basics; the lecturer says S1–13 must be known; start of SQL injection). — 0.75 h
- **SHOULD** Ch 3 S21, S25–27, S31–33 (card types, smart-card exchange, eID, remote authentication); Ch 4 S36–39 (identity federation). — 1.0 h
- **COULD** Practical 2 (Ch 3 S35–36) and Practical 3 (Ch 4 S43–50). — 0.5 h
- **Joint (optional):** J1 (≤30 min), Ch 1–2. It replaces part of the SHOULD slot.
- **Outcome:** Ch 3 and Ch 4 learned; Ch 5 background done.

### Mon 16 Nov — Ch 5 part B and Ch 6 (target 5.5 h; the heaviest MUST day)

- **MUST** Ch 5 part B: S17–23 (SQLi avenues, three attack types, countermeasures), S24–26 (administration models, `GRANT`/`REVOKE`, cascading revocation with Fig 5.6), S29–31 (inference), S32–34 (database encryption). *Example:* work Practical 4 Problem 5.8 by hand. **Note:** the revocation rule is *not printed on any text slide*. The knowledge map reverse-engineered a rule from the semester test and marks it as an assumption (Knowledge Map 4.1); treat Fig 5.6 and the textbook as the reference. — 2.25 h
- **MUST** Ch 6 part A: S3–9 (definition, Table 6.1, classification), S17–22 (viruses: components, four phases, types), S23–26 (worms and target discovery). — 1.5 h
- **MUST** Ch 6 part B: S34–38 (mobile code, drive-by, watering hole, malvertising, clickjacking), S40–41 (ransomware), S43–44 (bots), S46 (phishing), S47–50 (backdoor, rootkit), S51–55 (countermeasures). *Example:* build your own classification table (propagation vs payload). — 1.25 h
- **SHOULD** Ch 5 S27–28 (database RBAC), S42–46 (Practical 4 Problems 5.2 and 5.9). — 0.5 h
- **COULD** Ch 5 S35–40 (data centre security). — 0.5 h
- **Joint (optional):** J2 (≤40 min), Ch 3–4.
- **Outcome:** Ch 5 and Ch 6 learned. If this day runs long, the SHOULD slot is the catch-up block.

### Tue 17 Nov — Ch 7, Ch 8 and Ch 9 part A (target 5.5 h)

- **MUST** Ch 7: S3–4, S6–11 (spoofing, backscatter, SYN spoofing, flooding), S12–13 (DDoS and botnets), S16–19 (reflection and amplification), S20–22 (defences). *Example:* step through the TCP three-way handshake and show how the half-open table fills. — 1.25 h
- **MUST** Ch 8: S3–7 (intruder classes, short), S13 (six behaviour phases), S17–23 (IDS definitions, HIDS vs NIDS, anomaly vs signature), S24–25 (host IDS and data sources), S29–32 (NIDS and techniques), S37–38 (honeypots), S40–41 (Snort architecture and rule header). *Example:* read a Snort rule header field by field. — 2.25 h
- **MUST** Ch 9 part A: S3–7, S9–20 (packet filter, stateful inspection, application gateway, circuit-level gateway, SOCKS). *Example:* apply a small rule set to sample packets (open the Table 9.1 image on S11). — 1.25 h
- **SHOULD** Ch 7 S14–15, S23–24; Ch 8 S26–28, S33–36 (open the table and figure images). — 0.75 h
- **COULD** Ch 6 Practical 5 (S57–59); Ch 8 Table 8.1 (S14–16). — 0.5 h
- **Joint (optional):** J3 (≤30 min), Ch 5.
- **Outcome:** Ch 7 and Ch 8 learned; firewall types learned.

### Wed 18 Nov — Ch 9 part B, Ch 10 and Ch 11 part A (target 5.5 h)

- **MUST** Ch 9 part B: S21–23 (bastion hosts), S24–28 (DMZ, VPN, topologies; some renders were cropped, so open the slides), S29–33 (IPS, HIPS, NIPS). — 1.25 h
- **MUST** Ch 10: S3–10, S12–17 (stack frames and stack smashing), S18 (unsafe C routines), S19–20 (shellcode idea), S25–33 (compile-time vs run-time defences). *Example:* hand-trace the hex stack before and after the overflow (Fig 10.2, Fig 10.6). — 2.5 h
- **MUST** Ch 11 part A: S3–7, S11–16 (input handling, injection, the PHP examples), S22–24 (numeric validation, the 8-bit example). **Note:** the slide gives −59 for `10111011` (sign-magnitude); two's complement gives −69. Know both. — 1.25 h
- **SHOULD** Ch 10 S34–37 (other overflows), Ch 9 S34–36 (digital immune system, Snort Inline). — 0.5 h
- **COULD** Ch 9 S37–40, Ch 10 Practical 8. — 0.5 h
- **Joint (optional):** J4 (≤30 min), after David's exam.
- **Outcome:** Ch 9 and Ch 10 learned; Ch 11 half done.

### Thu 19 Nov — finish first pass, then the main joint day (5.25 h independent plus joint blocks)

Kyle's independent time is inside blocks T1, T3 and T4 (Section 9.3).

- **MUST** Ch 11 part B: S17–21 (XSS, validating syntax, canonicalization), S25, S32, S34–36 (fuzzing, race conditions, safe OS interaction, least privilege). — 1.25 h
- **MUST** Ch 13: S3–4, S8–16 (benefits, deployment models, service models), S18–19 (Table 13.1), S21–30 (NIST guidelines, seven CSA threats), S31 (multi-instance vs multi-tenant), S34–41 (IoT, fog, Table 13.4, requirements), S42–43 (MiniSec). — 1.75 h
- **SHOULD** deepening from the backlog in Section 10.3, chosen by technical load: second hex trace, packet-filter rules, transposition run, SQLi/XSS examples. Use it to prepare challenge questions for David. — 2.25 h
- **Outcome:** first pass of Ch 1–11 and 13 finished at MUST depth.

---

## 7. DAVID'S DETAILED DAILY ASSIGNMENTS

His other exam comes first. Everything before the 18th is flexible. The work is an **ordered queue** (Section 7.1): generally tackle prerequisite topics first, but **if time allows, continue into newer chapters rather than waiting for Thu 19**. A missed day simply moves the queue on. Depth targets **MV** (minimum viable) and **E** (exposure) are defined in Section 10.2. Time before 18 Nov is an estimate, not an obligation.

### 7.1 The queue (hours are estimates)

| # | Item | Depth | Hours |
|---|---|---|---|
| Q1 | Ch 1 | MV | 0.75 |
| Q2 | Ch 2 part A: symmetric encryption, DES/AES, hash, MAC (S3–26) | MV | 0.75 |
| Q3 | Ch 2 part B: public key, signatures, one transposition run (S27–38, S46–47) | MV | 0.75 |
| Q4 | Ch 3 | MV | 0.75 |
| Q5 | Ch 4 part A: policies, matrix, ACL vs capability, UNIX permissions (S4–6, S11–15, S18–21) | MV | 0.75 |
| Q6 | Ch 4 part B: RBAC, ABAC, ICAM overview (S23–35) | MV | 0.5 |
| Q7 | Ch 5 part A: background and SQLi (S3–23) | MV | 0.75 |
| Q8 | Ch 5 part B: administration, revocation, inference, encryption (S24–34) | MV | 0.75 |
| Q9 | Ch 6 part A: definitions, viruses, worms (S3–26) | MV | 1.0 |
| Q10 | Ch 6 part B: web delivery, ransomware, bots, rootkits, countermeasures (S34–55) | MV | 0.5 |
| Q11 | Ch 7 | **E** | 0.5 |
| Q12 | Ch 8 | MV | 1.25 |
| Q13 | Ch 9 | MV | 1.25 |
| Q14 | Ch 10 | MV | 1.25 |
| Q15 | Ch 11 | MV | 1.25 |
| Q16 | Ch 13 | **E** | 0.5 |
| | **Total** | | **13.25** |

### 7.2 Daily expectations

**Fri 13 Nov (suggested 1.5 h):**
- **MUST** Q1 Ch 1 — 0.75 h
- **MUST** Q2 Ch 2 part A — 0.75 h
- **COULD** Extra reading of Ch 2 S14–17 — 0.5 h
- *Example:* write the CIA triad with one example each, from memory.

**Sat 14 Nov (no COS330 required):** David chooses whether to rest or study; the golf day is Kyle's protected day and nothing here depends on it.
- **SHOULD** (only if David is free): Q3 Ch 2 part B, including one full transposition run. — 1.0 h

**Sun 15 Nov (suggested 1.5 h):**
- **MUST** Q4 Ch 3 — 0.75 h
- **MUST** Q5 Ch 4 part A — 0.75 h
- **COULD** Judge five passwords of his own with reasons — 0.5 h
- *If Sat was skipped:* do Q3 first, then Q4.
- *Optional:* J1 (≤30 min), Ch 1–2.

**Mon 16 Nov (suggested 1.5 h):**
- **MUST** Q6 Ch 4 part B — 0.5 h
- **MUST** Q7 Ch 5 part A — 0.75 h
- **MUST** Recall: explain Ch 3–4 aloud without notes — 0.25 h
- *Optional:* J2 (≤40 min), Ch 3–4.

**Tue 17 Nov (suggested 1.0 h; eve of his other exam, keep it light):**
- **MUST** Q8 Ch 5 part B — 0.75 h
- **MUST** Recall: UNIX permission string and a cascading-revocation example (Fig 5.6) on paper — 0.25 h
- *Optional:* J3 (≤30 min), Ch 5. Skip it if the other exam needs the time.

**Wed 18 Nov:** other exam. **No COS330 by day.**
- **SHOULD** (evening, only if rested): continue the earliest outstanding queue item, ideally Q9 Ch 6 part A — about 1.0–1.5 h including recall; if Ch 6 has already been completed, move into Ch 7 or Ch 8
- *Optional:* J4 (≤30 min).

**Thu 19 Nov:** use the adaptive template in Section 9.3, with **5.25 h independent and 2.5 h joint**. Start at the next actually unfinished Q-item after checking David's progress on the evening of the 18th.
- **T1 (2.0 h):** next outstanding queue items, ideally Ch 6–8 if David is on schedule.
- **T3 (2.0 h):** continue into Ch 9–10, including one packet-filter or stack-trace exercise where feasible.
- **T4 (1.25 h):** continue into Ch 11 and Ch 13; if time is tight, explicitly mark any chapter as **exposure** or **not yet reached**.
- **Do not double-count the 2.5 h joint discussion as independent first-pass reading.** The original Q10–Q16 queue is 6.5 h, so a Thursday-only attempt requires at least 1.25 h of pre-completion or an explicit reduction in depth.

### 7.3 Totals and checkpoint rules

- **Original queue:** Q1–Q16 add up to **13.25 h** of independent tasks. Q1–Q9 total **6.75 h**, and Q10–Q16 total **6.5 h**. Neither joint discussion time nor breaks may be used to make this sum appear smaller.
- **Before the 18th:** the dated suggestions total **5.5 h including 0.5 h recall**, not the 6.75 h needed for Q1–Q9. Optional work is therefore essential for reaching the original queue target. It is fine if David cannot manage it; the shortfall must be visible.
- **Checkpoints:** on Sun 15 after J1, Tue 17 after any J3, and Wed 18 evening, record David's **last genuinely completed queue item** and his available time for Thu 19. If he has extra time, use it on the **next Q-item**, including Ch 6–13. Do not continue rereading Ch 1–5 just because they were previously tested.
- **Thursday choices:** if all Q1–Q9 are complete, Thu 19 still has 6.5 h of new queue tasks for a 5.25 h independent window. Choose **(A)** complete at least 1.25 h of Q10–Q16 before Thursday if possible, **or (B)** use a shortened MV/exposure mix on Thursday, recording the reduced depth honestly (Section 9.3). If Q1–Q9 are not complete, prioritise remaining prerequisite material and downgrade later chapters to exposure as required. The 19th is **not** guaranteed full mastery.
- **Practical rule:** if David has less than 3 h of total independent time available by Tue 17, switch immediately to Scenario D rather than relying on an impossible catch-up on Thu 19.

## 8. PROTECTED GOLF / REST DAY — SATURDAY 14 NOVEMBER

- **Fully free for Kyle.** No reading, no assignments, no quizzes, no catch-up, no mandatory joint session.
- **Not a buffer.** It is never used to recover lost time. If Kyle falls behind, use Section 11. Nobody schedules a Saturday catch-up.
- **Why Saturday:** Fri 13 gives one day of momentum, then Sun–Wed run as four connected days into Thursday. Saturday is your stated preference. It also keeps Sun–Wed as four consecutive study days leading into Thursday; with Sunday as the rest day, Fri and Sat would be study days followed by a break and I see no advantage.
- **Weather swap:** if golf is rained out, swap the days. Move golf to Sun 15 and do Sun's tasks on Sat 14. Do not add hours to other days.
- **David:** no COS330 is required on this day. His optional hour is purely his choice.

---

## 9. JOINT DISCUSSIONS — SCHEDULE AND STRUCTURE

No clock times are set. Durations are approximate. Before the 18th every session is **short and optional**; Kyle's plan does not depend on any of them.

### 9.1 Schedule

| # | When | Length | Topics | Status |
|---|---|---|---|---|
| **J1** | Sun 15 | ≤30 min, optional | Ch 1–2 (CIA vocabulary, symmetric vs public key vs hash/MAC/signature, transposition steps) | ☐ |
| **J2** | Mon 16 | ≤40 min, optional | Ch 3–4 (authentication factors, password attacks, DAC/MAC/RBAC/ABAC, UNIX permissions) | ☐ |
| **J3** | Tue 17 | ≤30 min, optional, skip freely | Ch 5 (SQLi types, revocation, inference, encryption) | ☐ |
| **J4** | Wed 18 evening | ≤30 min, optional, skip freely | Ch 5 recap and Ch 6 preview | ☐ |
| **J5** | **Thu 19** | ≈2.5 h of joint blocks in a ≈9 h day | See 9.3 | ☐ |
| **J6** | **Fri 20** | ≈1 h 45 min (marking 75 min + rapid-fire 30 min) | Section 12 | ☐ |
| **J7** | Sat 21 morning | ≤20 min, optional | Each names five easily confused pairs and explains one | ☐ |

### 9.2 Format

Use this for every session. The purpose is understanding, not Kyle lecturing. **David explains first** on any topic he has studied.

| Part | Short session (≤30–40 min) | Longer block |
|---|---|---|
| **A. Overview** | 3 min: the chapter's big ideas | 5 min |
| **B. Explain** | 12 min: take turns, no notes, each explains two concepts and the other adds what is missing | 15–20 min |
| **C. Technical example** | 10 min: both attempt the same example separately, then compare | 15–20 min |
| **D. Challenge** | 5 min: each asks two "why", "what if", "compare", "limit" or "how could this be asked" questions | 10 min |
| **E. Verify** | 3 min: record gaps in Section 14 | 5 min |

### 9.3 Thursday 19 November — adaptive block plan

**Do not lock this schedule until the evening of 18 November.** Use the actual progress tracker to choose between the following options. An unstudied topic cannot become "learned" merely because Kyle explained it for ten minutes.

**Default only if David has completed Q1–Q9 and ideally at least 1.25 h of Q10–Q16 before Thursday:**

| Block | Duration | David (independent) | Kyle (independent) / joint activity |
|---|---:|---|---|
| **T1 Independent** | 2 h | Work on the next unfinished Q-items; aim for Ch 6–8 or the next later pair if already covered | Ch 11 part B; start Ch 13 |
| **T2 Joint** | 45 min | Explain only topics both have prepared; otherwise do a clearly labelled introductory overview | Teach-back + an appropriate technical example, ideally malware/DoS/IDS |
| *Lunch* | 45 min | Rest | Rest |
| **T3 Independent** | 2 h | Continue queue; prioritise Ch 9 packet-filter rules and Ch 10 stack trace if still outstanding | Complete Ch 13; optional technical deepening |
| *Break* | 15 min | Rest | Rest |
| **T4 Independent** | 1 h 15 min | Continue queue; prioritise Ch 11 and Ch 13 core concepts/exposure | Catch-up, optional deepening, or rest |
| **T5 Joint** | 60 min | Explain-back only for studied content; otherwise identify outstanding first-pass topics | Ch 9–11 applications and Ch 13 model comparisons, adapted to progress |
| *Break* | 15 min | Rest | Rest |
| **T6 Joint** | 45 min | Focus on unresolved shared concepts and old-chapter retrieval | Cross-chapter questions, record Friday practice priorities |

**Total:** 5 h 15 min independent + 2 h 30 min joint = **7 h 45 min active**, plus **1 h 15 min breaks** = **9 h elapsed**. The old version incorrectly allocated **6 h 30 min of Q10–Q16 work** into the 5 h 15 min independent blocks. This plan removes that hidden promise. If David has not moved ahead before Thursday, some chapters will receive **exposure rather than MV** coverage; record which ones.

**Thursday adjustment rules (ranked):**

1. If David is ahead of Q9, move the joint content forward accordingly and spend extra time on independent questions, not duplicated teaching.
2. If David is at Q6–Q9, shorten the old-chapter T6 block and allocate the joint time to the new topics he has actually prepared; continue first-pass reading independently.
3. If David is behind Q6, use Scenario D: a minimum-exposure sweep across remaining chapter headings and their key concepts, with technical drills reserved for selected procedures. Do **not** mark those chapters as first-pass complete.
4. If either student is fatigued, **reduce Kyle's SHOULD deepening and shorten T6 first**. Preserve the required independent study and critical technical practice wherever feasible; do not extend beyond the ~9 h elapsed template.
5. **Friday 20 remains practice and revision.** If a chapter is still untouched, the practice results and tracker must acknowledge that rather than claiming all content was covered.

## 10. MUST / SHOULD / COULD PRIORITIES

### 10.1 Definitions

| Tag | Meaning |
|---|---|
| **MUST** | Essential concepts and terminology, the main mechanisms and comparisons, the chapter's key technical example, and basic recall. Without this a chapter counts as not covered. |
| **SHOULD** | Extra detail, secondary figures and tables, further worked examples and consolidation. |
| **COULD** | Extension: more practice, practical write-ups, peripheral slides. |

Tiers are strictly about **time-allocation depth**, not exam probability or importance. **Every slide and practical within the official Ch 1–11 and 13 scope remains examinable**, including SHOULD and COULD material. Every chapter has a MUST tier, which is a minimum introduction and does not establish mastery. Mark a chapter "Exam ready" only after successful recall and application.

### 10.2 Tiers for David

| Tier | What it covers |
|---|---|
| **MV** (minimum viable) | A targeted first pass of core definitions, main comparisons, one technical example per technical chapter, plus individual recall. It is less thorough than Kyle's MUST and never equivalent to full examination readiness. |
| **E** (exposure) | An initial orientation to major lists, tables and definitions. **Do not record as "First pass completed" or "Exam ready".** This does not establish the ability to answer unseen exam questions. Ch 7: definition, resources attacked, flooding vs reflection vs amplification, four defence lines. Ch 13: service and deployment models, Table 13.1, seven CSA threats, Table 13.4, six IoT requirements. |

### 10.3 SHOULD backlog (not scheduled; use for early finishes and deepening)

Roughly 18.75 h of Kyle's SHOULD items are unscheduled. Pick by technical load, in this order:
1. Second timed run of the transposition (Ch 2).
2. Ch 5 revocation graphs: Practical 4 Problems 5.2, 5.8, 5.9.
3. Ch 10 shellcode and other overflows (S19–24, S34–37).
4. Ch 9 Tables 9.1–9.4, topologies, UTM (S27–28, S37–40).
5. Ch 11 safe-code slides (S26–31, S33, S37–42), XSS Fig 11.5.
6. Ch 6 worm model, Morris worm, APT (S10–16, S27–32); Practical 5.
7. Ch 8 Tables 8.1–8.4, Practical 7; Ch 4 Practical 3 and federation.
8. Ch 3, Ch 1 and Ch 13 remaining slides.

---

## 11. CATCH-UP BLOCKS AND FALLBACK PLANS

### 11.1 Rules that never change

- **The golf day (Sat 14) and the practice day (Fri 20) are never used to recover lost time.**
- No day is extended past 6 h to catch up.
- Catch-up uses each day's SHOULD slot, a +0.5 h extension (cap 6 h) and Thursday's deepening time, in that order.

### 11.2 Kyle's recovery buffers

| If the missed day is | MUST hours lost | Buffer available later | Shortfall |
|---|---|---|---|
| Fri 13 | 4.5 | 7.0 h | none (2.5 h spare) |
| Sun 15 | 4.5 | 5.5 h | none (1.0 h spare) |
| Mon 16 | 5.0 | 4.5 h | 0.5 h |
| Tue 17 | 4.75 | 3.25 h | 1.5 h |
| Wed 18 | 5.0 | 2.25 h | 2.75 h |

Buffer = later SHOULD slots + 0.5 h extensions + Thursday's 2.25 h deepening. The later the miss, the less room there is. The trims in 11.3 can only be taken from chapters not yet studied, so they cover the Mon and Tue shortfalls but **not** a Wed miss (only about 1.45 h of trims remain). If Wed is missed, go straight to Scenario B.

### 11.3 MUST-lite trims (Kyle's emergency list, about 3.5 h)

Use only for the shortfall, only on chapters not yet studied: Ch 4 S29–35 ICAM detail (0.4 h) · Ch 6 S34–38 web delivery to a definition-only read (0.4 h) · Ch 7 S16–19 reflection detail (0.35 h) · Ch 8 S3–11 intruder classes and S37–38 honeypots to a read (0.55 h) · Ch 9 S27–28 topologies (0.35 h) · Ch 10 S19–20 shellcode detail (0.4 h) · Ch 11 S25 and S32 (0.3 h) · Ch 13 S31 and S42–43 (0.4 h) · Ch 3 S28–30 (0.3 h).

### 11.4 Scenarios

**A — Kyle misses one study day.**
1. Drop that day's SHOULD and COULD entirely (do not reschedule them).
2. Move its MUST items into the next days' SHOULD slots, in order, using the table above.
3. Add at most +0.5 h to a later day (cap 6 h). Do not stretch every day.
4. If a shortfall remains (Mon, Tue or Wed miss), use the trims in 11.3.
5. Example: Tue is missed → Wed's SHOULD slot (0.5 h) + 0.5 h extension, then Thursday's deepening (2.25 h), then trims for the remaining 1.5 h.

**B — Kyle misses two study days.**
1. The buffers cannot absorb this. Switch every chapter **not yet studied** to the **MV tier** (the queue in 7.1), which is about half the MUST hours.
2. Keep MUST depth for chapters already finished.
3. Example: Mon and Tue missed → Wed and Thu give 10.75 h, and the remaining MV items need about 8.25 h, so everything still gets covered.
4. Keep the transposition, revocation, handshake, rule-evaluation, hex-trace and 8-bit examples. Cut breadth before cutting these.

**C — Kyle falls significantly behind** (more than two days of MUST lost, or fewer than about 15 h done by the end of Tue 17).
1. Follow the **minimum-viable plan**: the MV queue (13.25 h) for all remaining chapters in order, then the exposure tier for anything left.
2. Practise technical procedures first and fully: transposition, revocation, handshake, packet-filter rules, hex stack trace, 8-bit example.
3. Keep Thursday's joint blocks, but shift them toward explain-back rather than new content.
4. On Friday 20, reduce the *depth* of the mock (see Section 12): a 40-mark paper on chapters studied plus the technical drills.

**D — David makes less progress than expected.**
1. Joint sessions before the 18th are optional and do not change Kyle's plan. If David skips them, Kyle simply continues.
2. David continues the queue (7.1) from wherever he is. If he has time before his other exam, encourage **newer chapters** once prerequisites are understood. Nothing is skipped silently; skipped material goes in the outstanding tracker with its actual depth.
3. **Thursday will be too long at full MV depth unless he advances earlier:** Q10–Q16 need 6.5 h, but only 5.25 independent hours exist. Cut at least 1.25 h of planned depth or complete it before Thu. **Drop order if his Thursday gets too long** (each step trims about 0.25–0.5 h): (i) Ch 8 data-source detail S24–28 → reading only, (ii) Ch 9 topologies S27–28 → reading only, (iii) Ch 6 S34–38 → definitions only, (iv) Ch 4 part B ICAM → one-line definitions, (v) Ch 11 S22–24 numeric example → keep, but cut S25–36 to headings, (vi) Ch 2 part B transposition → keep one run, cut certificates.
4. **Emergency-only exposure floor:** a superficial 0.5 h orientation per chapter (about 6 h for twelve chapters) could fit in Wed evening + Thu independent time **only if he has that evening available**. This is not a guarantee of comprehension or exam readiness. If he cannot do any Wed work, the full 6 h also exceeds Thu's 5.25 h independent allocation.
5. On Thursday Kyle's deepening time becomes *question writing*: five short questions with answers per chapter pair, for David to attempt. Kyle does **not** lecture to replace David's reading; a short explanation is not equivalent to learning the material.
6. Friday's practice is adjusted by chapter depth for David, not turned into a content-learning day. **Never promise that every chapter received an MV first pass** if exposure was the only feasible coverage.

**E — A joint session is missed.**
- If it is within 24 hours and the topic is a prerequisite for the next chapter, reschedule it for the next free ≤30 min slot.
- Otherwise merge it into the next session as an extra Part B (e.g., J1 + J2 on Mon).
- If neither works, replace it with **independent teach-back**: each writes five questions with answers on the chapters, swaps them by message and answers them alone. Record gaps in Section 14.
- Thursday's T6 is the safety net for any topic still missed.

**F — We finish ahead of schedule.**
- Do **not** reread finished chapters.
- Use time for active recall: blank-page recall of each chapter, timed technical examples, explaining a chapter aloud without notes.
- Work the SHOULD backlog (10.3) in order of technical load.
- When mock questions exist, do a short exam-style set early.
- Never pull Sat 14 or Fri 20 into content work; extra time lengthens the evening off, not the study.

---

## 12. PRACTICE AND REVISION PLAN — FRIDAY 20 NOV, AND EXAM DAY

### 12.1 Friday 20 November: practice and revision ONLY

**No planned first-time chapter learning.** The target is productive, not exhausting: **6 h active** and about **6 h 50 min elapsed** with the specified breaks. Each person attempts everything independently before comparing. Use the semester test only to match the lecturer's format and expectations (matching, tables to copy, select-all picture items, argued short answers, one long procedure, a scenario).

Mock questions and a memorandum are **not generated yet**. Ask Claude to produce **two separate files** (unseen paper and private answer key) by Thursday evening after the 19 Nov session; do not display solutions while sitting the mock. Questions should sample across **all 12 examinable chapters**, not just those already covered, and any omissions must be called out.

| Block | Length | Mode | What |
|---|---|---|---|
| **P1** Active-recall warm-up | 40 min | Independent | Blank-page recall of each chapter group, about 3 min per chapter, then check against the slides |
| **P2** Technical drills | 60 min | Independent, timed | Rotate across all major procedure types: transposition, revocation graph, TCP handshake, packet-filter rule evaluation, hex stack trace, 8-bit example and SQLi/XSS. If seven full problems cannot fit, do short representative versions and complete any unfinished types in P5. Track which procedures each person actually attempted |
| *Break* | 30 min | – | – |
| **P3** Timed mock | 110 min | Independent, closed book | **60 marks** (1.8 min per mark), all twelve chapters represented, in test-style formats |
| *Break* | 20 min | – | – |
| **P4** Marking and discussion | 75 min | Joint | Mark against the memo; discuss why answers score or lose marks; note whether a loss came from missing knowledge or missing explanation |
| **P5** Targeted repair | 45 min | Independent | From Section 14: retrieval practice on the chapters that showed gaps, using the slides as the answer key. This is not new learning. |
| **P6** Rapid-fire | 30 min | Joint | Easily confused pairs and definitions, both directions |

**Coverage check.** Map the 60-mark mock against Ch 1–11 and 13: each chapter must appear at least once, although the marks need not be equal. Use P2 to cover practical mechanisms that a short mock cannot test in depth.

**Options.** If both feel well prepared, replace P3 + P5 with a full 100-mark, 3-hour mock plus 90 min marking. If either is behind (Scenario C or D), run a 40-mark mock on the studied chapters and extend P2. Stop at a sensible hour and sleep.

### 12.2 Saturday 21 November: exam day

- **Morning:** 60–75 min of light revision, finished by midday:
  - 20 min: write the main procedures from memory (transposition steps, revocation graph, stack layout, CIA impact levels);
  - 20 min: easily confused pairs (DAC/MAC/RBAC/ABAC, virus/worm/Trojan/bot, packet filter/stateful/proxy, anomaly/signature, compile-time/run-time defences, IaaS/PaaS/SaaS);
  - 15 min: your own list of common mistakes from Section 14;
  - 10 min: exam technique (make each point and explain it; copy tables carefully; select-all is all-or-nothing).
- **Do not:** start new material, sit another mock, or hold an intensive joint session close to the exam.
- **Afternoon:** eat, rest, travel. Arrive at the venue by **14:30** (Informatorium Orange / CBT labs, no preseating). The paper starts at 15:00, closed book on ClickUP.
- **During the exam:** about 1.8 minutes per mark; read the whole paper once; start where you are strongest; leave about 10 minutes to check.

---

## 13. PROGRESS TRACKERS

Statuses: Not started · In progress · First pass completed · Needs more practice · Exam ready.
**Nothing is marked complete because a date has passed.** Update only from what Kyle and David report.

### 13.1 Chapter tracker

Target depth is the **intended maximum depth given time**, not a record of achievement and not a proxy for exam likelihood. For David, the actual depth achieved (untouched / exposure / MV / more) must be documented separately when reported.

| Ch | Title | Kyle target | David target | Kyle status | David status | Joint discussion planned | Joint discussion done |
|---|---|---|---|---|---|---|---|
| 1 | Overview | MUST | MV | Not started | Not started | J1, J5-T6 | ☐ |
| 2 | Cryptographic tools | MUST | MV | Not started | Not started | J1, J5-T6 | ☐ |
| 3 | User authentication | MUST | MV | Not started | Not started | J2, J5-T6 | ☐ |
| 4 | Access control | MUST | MV | Not started | Not started | J2, J5-T6 | ☐ |
| 5 | Database and data centre security | MUST | MV | Not started | Not started | J3, J4, J5-T6 | ☐ |
| 6 | Malicious software | MUST | MV | Not started | Not started | J5-T2 | ☐ |
| 7 | Denial-of-service attacks | MUST | Exposure (conditional) | Not started | Not started | J5-T2 | ☐ |
| 8 | Intrusion detection | MUST | MV | Not started | Not started | J5-T2 | ☐ |
| 9 | Firewalls and IPS | MUST | MV | Not started | Not started | J5-T5 | ☐ |
| 10 | Buffer overflow | MUST | MV | Not started | Not started | J5-T5 | ☐ |
| 11 | Software security | MUST | MV | Not started | Not started | J5-T5 | ☐ |
| 13 | Cloud and IoT security | MUST | Exposure (conditional) | Not started | Not started | J5-T5 | ☐ |

(Chapter 12 is excluded and has no row.)

### 13.2 Joint discussions

| Completed | Still required |
|---|---|
| (none yet) | J1, J2, J3, J4 (all optional), J5, J6, J7 (optional) |

### 13.3 Outstanding technical examples

| Ch | Example | Done by Kyle | Done by David |
|---|---|---|---|
| 1 | CIA/impact table for a chosen system | ☐ | ☐ |
| 2 | Double columnar transposition (Practical 1), ≈18 min budget | ☐ | ☐ |
| 3 | Judge five passwords with reasons | ☐ | ☐ |
| 4 | UNIX permission string; ACL and capability list from a matrix | ☐ | ☐ |
| 5 | Cascading revocation graph (Fig 5.6, Practical 4 Problem 5.8) | ☐ | ☐ |
| 5 | SQLi attack types; inference example (Fig 5.8) | ☐ | ☐ |
| 6 | Malware classification table (propagation vs payload) | ☐ | ☐ |
| 7 | TCP handshake and half-open table | ☐ | ☐ (exposure only) |
| 8 | Snort rule header | ☐ | ☐ |
| 9 | Packet-filter rule evaluation (Table 9.1) | ☐ | ☐ |
| 10 | Hex stack trace before/after overflow (Fig 10.2, 10.6) | ☐ | ☐ |
| 11 | 8-bit signed example (−59 on the slide, −69 in two's complement) | ☐ | ☐ |
| 13 | Table 13.1 recall | ☐ | ☐ (exposure only) |

### 13.4 Missed or rescheduled work

| Date | Who | What was missed | Where it moved | Done? |
|---|---|---|---|---|
| | | | | |

---

## 14. OUTSTANDING QUESTIONS AND WEAKNESSES

Nothing is pre-filled. Strengths and weaknesses are recorded only when a student reports them or when a quiz, practice question or discussion shows them.

| Topics Kyle finds difficult | Chapter | Date added | Resolved? |
|---|---|---|---|
| | | | |

| Topics David finds difficult | Chapter | Date added | Resolved? |
|---|---|---|---|
| | | | |

| Topics both need to revisit | Chapter | Planned slot | Resolved? |
|---|---|---|---|
| | | | |

| Open questions for the lecturer or for Claude | Chapter | Date added | Answered? |
|---|---|---|---|
| Revocation convention is not on the text slides (Knowledge Map 4.1) | 5 | 12 Nov | ☐ |
| Slide says −59 for the 8-bit example; two's complement gives −69 | 11 | 12 Nov | ☐ |
| Whether any practicals are examinable in the final (not stated) | 2–6, 8, 10 | 12 Nov | ☐ |

---

## 15. SCHEDULE CHANGE LOG

| Date | Version | Change | Reason |
|---|---|---|---|
| 12 Nov 2026 | v1 | First draft | Created from the knowledge map |
| 12 Nov 2026 | v2 | Full rebuild | Both students relearn all 12 chapters; test results no longer drive priority or weakness labels; study starts Fri 13; protected golf day Sat 14; MUST/SHOULD/COULD tiers; fallback plans A–F; David's plan made a flexible queue; practice day reduced to about 6 h |
| 12 Nov 2026 | v3 | Feasibility and clarity revision | Audited queue/hour totals, split independent vs joint work, made David's new-chapter progress flexible, turned Thu 19 into a conditional plan, clarified priority tiers, and strengthened Friday mock/procedure coverage |
