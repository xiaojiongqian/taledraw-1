const functions = require("firebase-functions");
const {GoogleGenerativeAI} = require("@google/genai");
const {getStorage} = require("firebase-admin/storage");
const {initializeApp} = require("firebase-admin/app");

initializeApp();

// Initialize the Google Generative AI client with the API key from Firebase config
const genAI = new GoogleGenerativeAI(functions.config().gemini.apikey);

exports.generateTale = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated",
        "The function must be called while authenticated.");
  }

  const {story} = data;
  const model = genAI.getGenerativeModel({model: "gemini-2.5-flash"});

  const storyPrompt = `First, create a detailed description of the main
    characters in the following story. Then, based on the story, generate a
    series of image prompts for a children"s book. Each prompt should describe
    a single scene. Use the character descriptions you created to ensure the
    characters look the same in every image. Story: ${story}`;

  const result = await model.generateContent(storyPrompt);
  const response = await result.response;
  const text = await response.text();
  const prompts = text.split("\n").filter((prompt) => prompt.trim() !== "");

  const images = await Promise.all(prompts.map(async (prompt, index) => {
    const imageUrl = `https://via.placeholder.com/400?text=${encodeURIComponent(prompt)}`;
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();

    const bucket = getStorage().bucket();
    const fileName = `tales/${context.auth.uid}/` +
      `${Date.now()}_${index}.png`;
    const file = bucket.file(fileName);
    await file.save(Buffer.from(imageBuffer));
    return file.publicUrl();
  }));

  return {pages: prompts.map((prompt, index) => (
    {text: prompt, image: images[index]}),
  )};
});