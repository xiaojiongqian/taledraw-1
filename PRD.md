Use Gemini and Imagen 4 to create auto draw tale book react app.

Here's the app flow:

1. User uploads the text of a story.
2. The app uses Gemini to generate the prompt(JSON format) for Imagen 4 of many pages of the story.
3. The app uses Imagen 4 to generate a drawing of each page of the story.
4. The app displays the story(use the same language as input text) and the drawings in a scrollable page.
5. User can input the numbers of pages of the story, and default is 10 pages.
6. The gerented tale book can be saved to the firebase storage, and user can reload from the history list.

note:
1.The drawing should be in the same style of each page.
2.The role will have a name, so that it can keep the same looking due to the content.
3.We can use the role's picture for imagen model reference, to gen the role's correct looking.
4.Content safety optimization to ensure high generation success rate and child-friendly content.

## Content Safety Requirements:

### 1. Multi-layer Safety Protection
- **LLM Level**: Gemini automatically converts controversial content to friendly descriptions
- **Frontend Level**: Real-time safety word replacement for user inputs  
- **Image Generation Level**: Automatic addition of safe and welcoming atmosphere descriptions
- **User Interface Level**: Safety tips and guidelines for content creation

### 2. Safety Transformations
- Violence → Friendly competition or discussion
- Horror elements → Mysterious adventures or interesting challenges
- Negative emotions → Confusion or need for help
- Dangerous activities → Safe exploration under supervision
- Stereotypes → Inclusive and diverse descriptions

### 3. Child-Friendly Optimization
- All generated content suitable for children's books
- Friendly expressions and warm colors emphasized
- Safe and welcoming atmosphere in all images
- Inclusive character descriptions avoiding stereotypes

implement detail:
1.Only use react app, no need server.
2.Use firebase Functions to invoke GCP API, so we need adopt authentication(email/password) of firebase.
3.Use firebase storage to store the drawings.
4.The firebase resource is in the firebaseresouce file.
5.Use npx to run firebase tools.
6.Use LLM model: gemini-2.5-flash, Imagen 3







