const axios = require('axios');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Ensure required environment variables are set
if (!process.env.GEMINI_API_KEY || !process.env.LINKEDIN_ACCESS_TOKEN) {
    console.error("Missing required environment variables. Please set GEMINI_API_KEY and LINKEDIN_ACCESS_TOKEN.");
    process.exit(1);
}

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateLinkedInPost() {
    console.log("Generating post content with Gemini...");
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const prompt = `Write a highly engaging, professional, and insightful LinkedIn post (under 1500 characters) about a recent development or best practice in Generative AI or Agentic AI. 
    Use a hook, provide value, and end with a thought-provoking question to encourage engagement. Include 3-4 relevant hashtags. Do not use markdown formatting like **bold** because LinkedIn API handles text linearly, just write plain text with line breaks.`;

    try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        console.log("Generated Content:\n", text);
        return text;
    } catch (error) {
        console.error("Error generating content:", error);
        throw error;
    }
}

async function getLinkedInAuthorUrn(accessToken) {
    console.log("Fetching LinkedIn profile data to get URN...");
    try {
        const response = await axios.get('https://api.linkedin.com/v2/userinfo', {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        
        // Sometimes the endpoint is /v2/me and returns id
        // In newer versions with openid scope, it's /v2/userinfo and returns sub
        const id = response.data.sub || response.data.id;
        if (!id) {
            throw new Error("Could not find user ID in response");
        }
        
        const urn = `urn:li:person:${id}`;
        console.log("Found URN:", urn);
        return urn;
    } catch (error) {
        // Fallback to /v2/me if /v2/userinfo fails
        try {
            console.log("Fallback: Fetching from /v2/me...");
            const response = await axios.get('https://api.linkedin.com/v2/me', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'X-Restli-Protocol-Version': '2.0.0'
                }
            });
            const urn = `urn:li:person:${response.data.id}`;
            console.log("Found URN:", urn);
            return urn;
        } catch (fallbackError) {
             console.error("Error fetching LinkedIn profile:", fallbackError.response ? fallbackError.response.data : fallbackError.message);
             throw fallbackError;
        }
    }
}

async function createLinkedInPost(accessToken, authorUrn, text) {
    console.log("Publishing post to LinkedIn...");
    const url = 'https://api.linkedin.com/v2/ugcPosts';
    
    const data = {
        author: authorUrn,
        lifecycleState: "PUBLISHED",
        specificContent: {
            "com.linkedin.ugc.ShareContent": {
                shareCommentary: {
                    text: text
                },
                shareMediaCategory: "NONE"
            }
        },
        visibility: {
            "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
        }
    };

    try {
        const response = await axios.post(url, data, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'X-Restli-Protocol-Version': '2.0.0'
            }
        });
        console.log('Post created successfully! URN:', response.data.id);
    } catch (error) {
        console.error('Error creating post:', error.response ? JSON.stringify(error.response.data) : error.message);
        throw error;
    }
}

async function main() {
    try {
        const accessToken = process.env.LINKEDIN_ACCESS_TOKEN;
        const authorUrn = await getLinkedInAuthorUrn(accessToken);
        const postContent = await generateLinkedInPost();
        await createLinkedInPost(accessToken, authorUrn, postContent);
        console.log("Automation completed successfully.");
    } catch (error) {
        console.error("Automation failed.");
        process.exit(1);
    }
}

main();
