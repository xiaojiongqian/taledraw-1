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

implement detail:
1.Only use react app, no need server.
2.Use firebase sdk to invoke GCP API, so we need adopt authentication(email/password) of firebase.
3.Use firebase storage to store the drawings.
4.The firebase resource is in the firebaseresouce file.
5.We should use the latest/correct/stable version of firebase/GCP API, especially the Imagen-4 API correctly.







