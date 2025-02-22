import daisyui from "daisyui";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {},
  },
  daisyui: {
    
    
    themes: ["cupcake", "dark", "forest", {
      "tree": {
        "primary": "#6b8572",          // Brighter sage green but still muted
        "primary-content": "#f0f4f1",  // Crisp light grey-green for text
        
        "secondary": "#495e50",        // Brighter deep forest green
        "secondary-content": "#e8efe9", // Light grey-green for text
        
        "accent": "#84ab91",           // Brighter medium green, still muted
        "accent-content": "#0c110e",   // Very dark green for text
        
        "neutral": "#161719",          // Dark grey base, slightly brighter
        "neutral-content": "#e8e9eb",  // Light grey for text
        
        "base-100": "#1a1d1f",         // Darkest background, lifted slightly
        "base-200": "#1e2123",         // Slightly lighter
        "base-300": "#222527",         // Even lighter for contrast
        "base-content": "#eaebeb",     // Light grey for main text
        
        "info": "#618e94",            // Brighter blue-grey
        "info-content": "#e5f2f4",    // Light blue-grey for text
        
        "success": "#5c7a69",         // Brighter forest green
        "success-content": "#eaf1ec",  // Light green for text
        
        "warning": "#7e6a50",         // Brighter amber, still muted
        "warning-content": "#f7f1e9",  // Light amber for text
        
        "error": "#855252",           // Brighter dark red, still muted
        "error-content": "#f7e9e9"    // Light red for text
      }
    }],
  },

  plugins: [daisyui],
};
