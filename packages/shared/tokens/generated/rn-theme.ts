export const RN_THEME = {
  "light": {
    "colors": {
      "paper": "#F9F6F1",
      "surface": "#FEFDFA",
      "surface-2": "#F8F5F1",
      "surface-3": "#F4F1ED",
      "line": "#E4E1DB",
      "line-soft": "#EBE7E1",
      "ink": "#26201B",
      "ink-2": "#524C47",
      "ink-3": "#68625C",
      "accent": "#2D6BAB",
      "accent-press": "#125492",
      "accent-tint": "#EDF4FD",
      "accent-ink": "#0F4A85",
      "danger": "#874131",
      "scrim": "#26201B"
    },
    "outcome": {
      "offer": "#20714A",
      "rejected": "#A96656",
      "ghosted": "#BCB6AE",
      "withdrawn": "#747990"
    },
    "stage": {
      "applied": "#2A4367",
      "screening": "#1C719A",
      "tech": "#499B9B",
      "final": "#D9B982"
    },
    "data": [
      "#2A4367",
      "#1C719A",
      "#499B9B",
      "#7FA76A",
      "#D9B982",
      "#EEC7B6"
    ]
  },
  "dark": {
    "colors": {
      "paper": "#1E1A16",
      "surface": "#2A2521",
      "surface-2": "#352F2B",
      "surface-3": "#1E1A16",
      "line": "#47413C",
      "line-soft": "#47413C",
      "ink": "#EBE7E1",
      "ink-2": "#C1BDB7",
      "ink-3": "#A39E96",
      "accent": "#6AA9EE",
      "accent-press": "#4C8FD8",
      "accent-tint": "#243951",
      "accent-ink": "#6AA9EE",
      "danger": "#D58775",
      "scrim": "#26201B"
    },
    "outcome": {
      "offer": "#51BD85",
      "rejected": "#D58775",
      "ghosted": "#6D6860",
      "withdrawn": "#8B91AB"
    },
    "stage": {
      "applied": "#2A4367",
      "screening": "#1C719A",
      "tech": "#499B9B",
      "final": "#D9B982"
    },
    "data": [
      "#2A4367",
      "#1C719A",
      "#499B9B",
      "#7FA76A",
      "#D9B982",
      "#EEC7B6"
    ]
  },
  "space": {
    "1": 4,
    "2": 8,
    "3": 12,
    "4": 16,
    "5": 20,
    "6": 24,
    "8": 32,
    "10": 40,
    "12": 48,
    "14": 56
  },
  "radius": {
    "xs": 5,
    "sm": 8,
    "md": 9,
    "lg": 12,
    "xl": 14,
    "2xl": 16,
    "3xl": 20,
    "pill": 999
  },
  "control": {
    "xs": {
      "height": 28,
      "radius": 8,
      "fontSize": 12,
      "padX": 12
    },
    "sm": {
      "height": 32,
      "radius": 8,
      "fontSize": 12.5,
      "padX": 13
    },
    "md": {
      "height": 36,
      "radius": 9,
      "fontSize": 13.5,
      "padX": 16
    },
    "lg": {
      "height": 42,
      "radius": 10,
      "fontSize": 14.5,
      "padX": 20
    }
  },
  "elevation": {
    "flat": {
      "borderWidth": 1,
      "borderColor": "#E4E1DB"
    },
    "e1": {
      "ios": {
        "shadowColor": "#26201B",
        "shadowOpacity": 0.06,
        "shadowRadius": 12,
        "shadowOffset": {
          "width": 0,
          "height": 4
        }
      },
      "android": {
        "elevation": 2
      }
    },
    "e2": {
      "ios": {
        "shadowColor": "#26201B",
        "shadowOpacity": 0.1,
        "shadowRadius": 20,
        "shadowOffset": {
          "width": 0,
          "height": 8
        }
      },
      "android": {
        "elevation": 5
      }
    },
    "e3": {
      "ios": {
        "shadowColor": "#26201B",
        "shadowOpacity": 0.16,
        "shadowRadius": 32,
        "shadowOffset": {
          "width": 0,
          "height": 14
        }
      },
      "android": {
        "elevation": 12
      }
    },
    "accent": {
      "ios": {
        "shadowColor": "#125492",
        "shadowOpacity": 0.28,
        "shadowRadius": 14,
        "shadowOffset": {
          "width": 0,
          "height": 6
        }
      },
      "android": {
        "elevation": 4
      }
    }
  }
} as const;
