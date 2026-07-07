# Ollama Configuration UI Layout

## Before (Single Card)

```
┌─────────────────────────────────────────────────────────┐
│ Ollama                                                   │
│ Use your self-hosted model at home or internal network  │
├─────────────────────────────────────────────────────────┤
│ Base URL                                                 │
│   Local URL                                              │
│   [http://127.0.0.1:11434                  ]            │
│   Use this for a local Ollama instance                  │
│                                                          │
│   Hosted URL                                             │
│   [http://your-ollama-host.com:11434       ]            │
│   Use this for a hosted Ollama endpoint                 │
│                                                          │
│ Model                                                    │
│ [Qwen 3 8B                                  ▼]          │
└─────────────────────────────────────────────────────────┘
```

## After (Two Separate Cards)

### Card 1: Ollama (Local)
```
┌─────────────────────────────────────────────────────────┐
│ Ollama (Local)                                           │
│ Use your self-hosted model on same machine or network   │
├─────────────────────────────────────────────────────────┤
│ Local URL                                                │
│ [http://127.0.0.1:11434                    ]            │
│ Use this for a local Ollama instance                    │
│                                                          │
│ Model                                                    │
│ [Qwen 3 8B                                  ▼]          │
└─────────────────────────────────────────────────────────┘
```

### Card 2: Ollama (Hosted)
```
┌─────────────────────────────────────────────────────────┐
│ Ollama (Hosted)                                          │
│ Use a hosted Ollama endpoint with advanced RAG features │
├─────────────────────────────────────────────────────────┤
│ Hosted URL                                               │
│ [http://your-ollama-host.com:11434         ]            │
│ Use this for a publicly accessible endpoint             │
│                                                          │
│ ┌─────────────────────────┬─────────────────────────┐  │
│ │ Default Model           │ Embedding Model         │  │
│ │ [qwen2.5:14b-instruct  ]│ [nomic-embed-text      ]│  │
│ └─────────────────────────┴─────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────┬─────────────────────────┐  │
│ │ Embedding Dimension     │ Question Gen Model      │  │
│ │ [768                   ]│ [qwen2.5:14b-instruct  ]│  │
│ └─────────────────────────┴─────────────────────────┘  │
│                                                          │
│ ┌─────────────────────────┬─────────────────────────┐  │
│ │ Analysis Model          │ RAG Top K               │  │
│ │ [qwen2.5:14b-instruct  ]│ [5                     ]│  │
│ └─────────────────────────┴─────────────────────────┘  │
│                                                          │
│ ┌───────────┬────────────────┬────────────────────┐    │
│ │ Num GPU   │ Context Size   │ Timeout (ms)       │    │
│ │ [0       ]│ [8192         ]│ [900000           ]│    │
│ └───────────┴────────────────┴────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Layout Comparison

| Aspect | Old Layout | New Layout |
|--------|------------|------------|
| **Cards** | 1 card | 2 cards |
| **Local Fields** | Mixed | 2 dedicated fields |
| **Hosted Fields** | 1 URL only | 11 fields |
| **Grid Layout** | Single column | 2-3 column grid |
| **RAG Config** | Not available | Full configuration |
| **Clarity** | Confusing | Clear separation |

## Field Organization

### Ollama Local (Simple)
```
Local URL (text input)
Model (dropdown select)
```

### Ollama Hosted (Advanced)
```
Hosted URL (text input)

Row 1: [Default Model] [Embedding Model]
Row 2: [Embedding Dim] [Question Model]
Row 3: [Analysis Model] [RAG Top K]
Row 4: [Num GPU] [Context Size] [Timeout]
```

## Responsive Behavior

### Desktop (≥1024px)
- Both cards side-by-side in 2-column grid
- Hosted card shows 2-3 column sub-grids

### Tablet (768px - 1023px)
- Cards stack vertically
- Hosted card maintains 2-column sub-grids

### Mobile (<768px)
- All cards stack vertically
- All fields full-width
- Sub-grids become single column

## Color Coding

Both cards use the same cyan/teal accent:
```css
border-cyan-500/40 bg-cyan-950/20
```

This maintains visual consistency while separating functionality.

## Status Indicators

Each card shows configuration status:
- ✅ **Database** - Value saved in database (green)
- ⚠️ **.env fallback** - Using environment variable (yellow)
- ⭕ **No key configured** - Not set (gray)

## Provider Selection Dropdown

Updated options:
```
┌─────────────────────────────────────────────────────┐
│ Default provider order                               │
│ [Auto — try all configured providers        ▼]     │
│                                                      │
│ Options:                                             │
│ • Auto — try all configured providers               │
│ • Gemini only                                        │
│ • OpenAI only                                        │
│ • Ollama (Local) only          ← NEW               │
│ • Ollama (Hosted) only         ← NEW               │
│ • Any configured Ollama                             │
└─────────────────────────────────────────────────────┘
```

## Save Button

Fixed at bottom of page:
```
┌──────────────────────────────────────────────────────────┐
│ Keys are stored securely in the database — not in .env   │
│                                      [💾 Save changes]   │
└──────────────────────────────────────────────────────────┘
```

## Benefits of New Layout

✅ **Visual Separation**: Clear distinction between local and hosted
✅ **Reduced Confusion**: Users see relevant fields only
✅ **Better Organization**: Related fields grouped together
✅ **Progressive Disclosure**: Simple config (local) vs advanced (hosted)
✅ **Responsive Design**: Works on all screen sizes
✅ **Professional Look**: Grid-based layout is modern and clean
