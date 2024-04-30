import express from "express";
import cors from "cors";
import db from "./db/connection.js";

const PORT = process.env.PORT || 8000;
const app = express();
app.use(cors());
app.use(express.json());

// API to get questions by question topic
app.get('/question-topics/:topic', function (req, res) {
    const topic = req.params["topic"];
    db.collection("questions").find({
        QuestionTopic: topic,
    }).toArray()
        .then(questions => {
            if (questions.length === 0) {
                return res.status(404).send("No questions found for the provided topic.");
            }
            res.send(questions);
        })
        .catch(() => res.status(500).send("Internal Server Error"));
});

// API to get all question topics
app.get('/question-topics', function (req, res) {
    db.collection("questions").distinct('QuestionTopic')
        .then(topics => {
            res.send(topics);
        })
        .catch(() => res.status(500).send("Internal Server Error"));
});

// API to post a new question
app.post('/addquestions', async function (req, res) {
    const { QuestionTopic, Question, Option1, Option2, Option3, Option4, Answer, Explanation, Attempts, Solved, DifficultyLevel } = req.body;

    try {
        // Retrieve the current maximum QuestionId
        const maxQuestionId = await db.collection("questions").find().sort({ QuestionId: -1 }).limit(1).toArray();
        let newQuestionId = 1; // Default value if no questions exist yet

        if (maxQuestionId.length > 0) {
            newQuestionId = maxQuestionId[0].QuestionId + 1;
        }

        // Create a new question object
        const newQuestion = {
            QuestionId: newQuestionId,
            Date: new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' }), // Get current date in EST (MM/DD/YY) format
            QuestionTopic,
            Question,
            Option1,
            Option2,
            Option3,
            Option4,
            Answer,
            Explanation,
            Attempts,
            Solved,
            DifficultyLevel
        };

        // Insert the new question into the database
        const result = await db.collection("questions").insertOne(newQuestion);

        if (result.acknowledged) {
            res.status(201).send("Question added successfully.");
        } else {
            res.status(500).send("Failed to add question.");
        }
    } catch (error) {
        console.error("Error adding question:", error);
        res.status(500).send("Failed to add question.");
    }
});

// Add your other APIs here...

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
