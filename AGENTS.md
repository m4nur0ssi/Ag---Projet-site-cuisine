# Project Notes

## Recipe Image Generation

When generating or regenerating recipe images for this project:

- Use the TikTok video attached to the recipe as the visual model.
- Read the first 4 seconds and the last 4 seconds of the TikTok video before generating.
- Use those frames to identify the real dish, plating, ingredients, colors, texture, and final presentation.
- Generate the recipe image as a realistic food photo taken from above or near-overhead.
- Include natural table/kitchen context around the dish, as in the approved Maritozzi example.
- Vary plate, bowl, and serving dish shapes and colors between recipe images. Prefer the servingware seen or implied in the TikTok video, and avoid repeating the same plain white round plate style across a batch unless the video clearly calls for it.
- Avoid people, hands, faces, TikTok UI, watermarks, captions, logos, and in-image text.
- Keep the generated image faithful to the actual recipe video rather than making a generic attractive food image.
- Save both project formats:
  - `public/recipes-ia/<id>-carte.webp` at `760x1004`
  - `public/recipes-ia/<id>.webp` at `1200x1586`
- After replacing assets, run `npm run build:home-data` and verify the recipe still points to `/recipes-ia/<id>-carte.webp`.

Approved example: recipe `7830` / "Recette de Maritozzi".

## Image direction (skill)

`docs/image-direction-SKILL.md` définit la méthode (brief structuré, contrôle puis correction ciblée). Elle est branchée dans `scripts/generate-recipe-images.js` : ligne « Usage » dans le prompt, et `controlerImage()` relit chaque image générée (texte, mains, déformations, plat non conforme, angle) puis relance UNE correction ciblée. Non bloquant ; `--sans-controle` pour couper. Tourne automatiquement sur chaque nouvelle recette via `.github/workflows/wp-sync.yml`.
