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

// API to submit answers
app.post('/submit-answers', async function (req, res) {
    console.log("reached")
    const { studentId, questionIds } = req.body; // Assuming you pass an array of question IDs the student has answered
    console.log("req.body "+req.body)
    try {
        // Check if the student already exists in the question_solved collection
        const student = await db.collection("question_solved").findOne({ studentId });

        if (student) {
            // Update the student's solved questions list
            await db.collection("question_solved").updateOne(
                { studentId },
                { $addToSet: { solvedQuestions: { $each: questionIds } } } // Using $addToSet to avoid duplicates
            );
        } else {
            // If no student exists, create a new record
            await db.collection("question_solved").insertOne({
                studentId,
                solvedQuestions: questionIds
            });
        }
        res.status(200).json({ message: "Answers submitted successfully." });
    } catch (error) {
        console.error("Error submitting answers new :", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// API to get solved questions by student ID
app.get('/solved-questions/:studentId', async function (req, res) {
    const studentId = parseInt(req.params.studentId);

    try {
        const studentData = await db.collection("question_solved").findOne({ studentId });

        if (studentData && studentData.solvedQuestions) {
            res.status(200).json(studentData.solvedQuestions);
        } else {
            res.status(404).send("No solved questions found for the provided student ID.");
        }
    } catch (error) {
        console.error("Error fetching solved questions:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

app.get('/create-test', async function (req, res) {
    const { numberOfQuestions } = req.query;

    try {
        // Retrieve all questions from the database
        const allQuestions = await db.collection("questions").find().toArray();

        // Check if there are enough questions available
        if (allQuestions.length < numberOfQuestions) {
            return res.status(400).send("Not enough questions available.");
        }

        // Shuffle the array of questions to randomize the selection
        const shuffledQuestions = shuffleArray(allQuestions);

        // Select the specified number of random questions
        const selectedQuestions = shuffledQuestions.slice(0, numberOfQuestions);

        res.send(selectedQuestions);
    } catch (error) {
        console.error("Error creating test:", error);
        res.status(500).send("Failed to create test.");
    }
});

// Function to shuffle an array (Fisher-Yates shuffle algorithm)
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}
// Add your other APIs here...
app.post('/signup', async (req, res) => {
    try {
        const { firstname, lastname, email, password, isTeacher } = req.body;
        const role = isTeacher ? 'teacher' : 'student';

        // Check if the email already exists in the database
        const existingUser = await db.collection("user").findOne({ email });
        if (existingUser) {
            return res.status(400).send("Email already exists.");
        }

        // Retrieve the current maximum UserId
        const maxUserId = await db.collection("user").find().sort({ UserId: -1 }).limit(1).toArray();
        let newUserId = 1; // Default value if no users exist yet

        if (maxUserId.length > 0) {
            newUserId = maxUserId[0].UserId + 1;
        }

        // Create a new user object
        const newUser = {
            UserId: newUserId,
            firstname,
            lastname,
            email,
            password,
            role
        };

        // Insert the new user into the database
        const result = await db.collection("user").insertOne(newUser);

        if (result.acknowledged) {
            res.status(201).json({message : 'User added successfully.'});
        } else {
            res.status(500).send("Failed to add User.");
        }
    } catch (error) {
        console.error("Error adding User:", error);
        res.status(500).send("Failed to add User.");
    }
});


app.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Check if a user with the provided email exists
        const user = await db.collection("user").findOne({ email });

        if (!user) {
            return res.status(404).send("User not found.");
        }

        // Check if the password matches
        if (user.password !== password) {
            return res.status(401).send("Incorrect password.");
        }

        // If email and password match, send a success response
        res.status(200).json({ message: 'Login successful', user });
    } catch (error) {
        console.error("Error during login:", error);
        res.status(500).send("Internal Server Error");
    }
});

app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});
