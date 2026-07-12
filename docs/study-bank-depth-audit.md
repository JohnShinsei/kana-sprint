# Study Bank Depth Audit

Kana Sprint ships a local N5-N1 study bank with separate vocabulary and original anime-style line prompts for each JLPT level.

## Summary

- Risk: PASS
- JLPT levels: 5
- Total study items: 853
- Kana prompts: 92
- Vocabulary prompts: 513
- Original anime-style line prompts: 148
- Grammar prompts: 100
- Playable meaning prompts: 661
- Topic families: 26
- Duplicate IDs: 0
- Duplicate displays by level/kind: 0

## Level Depth

| Level | Kana | Vocabulary | Lines | Grammar | Topics | Vocab topics | Line topics | Avg kana length | Line mix weight | Grammar mix weight | Reverse recall weight |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| N5 | 92 | 137 | 44 | 20 | 21 | 17 | 5 | 4.43 | 0.18 | 0.2 | 0.32 |
| N4 | 0 | 94 | 26 | 20 | 22 | 19 | 10 | 5.67 | 0.26 | 0.28 | 0.4 |
| N3 | 0 | 94 | 26 | 20 | 16 | 15 | 8 | 6.2 | 0.29 | 0.31 | 0.48 |
| N2 | 0 | 94 | 26 | 20 | 13 | 11 | 6 | 6.38 | 0.32 | 0.34 | 0.56 |
| N1 | 0 | 94 | 26 | 20 | 13 | 12 | 7 | 6.78 | 0.35 | 0.37 | 0.64 |

## Difficulty Progression

Difficulty increases through level-specific content, higher line-prompt weight, more reverse Japanese recall, same-topic distractors, and longer average kana readings.

| Level | Order | Kana weight | Vocabulary weight | Line weight | Grammar weight | Reverse recall weight | Topic bias | Length bias | Avg kana length |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| N5 | 1 | 0.28 | 0.34 | 0.18 | 0.2 | 0.32 | 0 | 0 | 4.43 |
| N4 | 2 | 0 | 0.46 | 0.26 | 0.28 | 0.4 | 1 | 0 | 5.67 |
| N3 | 3 | 0 | 0.4 | 0.29 | 0.31 | 0.48 | 2 | 0 | 6.2 |
| N2 | 4 | 0 | 0.34 | 0.32 | 0.34 | 0.56 | 3 | 1 | 6.38 |
| N1 | 5 | 0 | 0.28 | 0.35 | 0.37 | 0.64 | 4 | 2 | 6.78 |

## Release Gate Issues

- None.

If this audit fails, expand or rebalance the study bank before generating App Store assets again.
