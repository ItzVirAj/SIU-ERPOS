import { NextRequest, NextResponse } from "next/server";
import { requireTeamMember, handleRouteError, HttpError } from "@/lib/authz";
import { getEventById, upsertMeetingNote } from "@/lib/api/calendar";
import { generateText } from "ai";
import { createGroq } from "@ai-sdk/groq";
import { db } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ teamId: string; eventId: string }> }
) {
  try {
    const { teamId, eventId } = await params;
    await requireTeamMember(teamId, "developer");

    const event = await getEventById(teamId, eventId);
    if (!event) {
      throw new HttpError(404, "Event not found");
    }

    const body = await request.json();
    const transcriptText = body.transcript || body.content || event.meetingNote?.rawTranscript || event.description || "";

    if (!transcriptText || transcriptText.trim().length === 0) {
      throw new HttpError(400, "Transcript or meeting content is required for AI summarization");
    }

    // Resolve Groq API key: team key, client payload key, or process.env.GROQ_API_KEY
    const team = await db.team.findUnique({
      where: { id: teamId },
      select: { groqApiKey: true },
    });

    const apiKey =
      team?.groqApiKey ||
      body.apiKey ||
      process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new HttpError(400, "No Groq API key configured. Please configure your API key in Settings or pass it.");
    }

    const groq = createGroq({ apiKey });

    // Fetch team members & project context to help AI match assignees
    const members = await db.teamMember.findMany({
      where: { teamId },
      select: { userName: true, userEmail: true },
    });
    const memberNames = members.map((m) => m.userName).join(", ");

    const systemPrompt = `You are the SketchItUp Meeting Intelligence Bot (PRD CAL-09 / CAL-W2).
Your task is to analyze meeting audio transcripts or raw notes and extract structured intelligence.

The team has the following active members:
${memberNames || "No named members"}

Project: ${event.project?.name || "General"}
Meeting Title: ${event.title}

Respond with valid JSON adhering strictly to this schema:
{
  "summary": "5-bullet or 5-line executive summary of what transpired",
  "decisions": "Bullet list of key decisions, agreements, or approvals made in the meeting",
  "followUpEmailDraft": "A professional, warm client or internal follow-up email draft summarizing the call and thanking attendees",
  "actionItems": [
    {
      "title": "Clear actionable task title",
      "assigneeName": "Name of the person responsible if mentioned, or null",
      "dueDate": "ISO string format date if a deadline was mentioned, or null"
    }
  ]
}

DO NOT wrap the response in markdown backticks or any other text. Output ONLY raw parseable JSON.`;

    const modelName = "llama-3.3-70b-versatile"; // high speed, high reasoning JSON support
    let aiOutput: any = null;

    try {
      const response = await generateText({
        model: groq(modelName),
        system: systemPrompt,
        prompt: `Meeting Notes / Transcript:\n\n${transcriptText}`,
        temperature: 0.2,
      });

      const cleanedText = response.text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```$/i, "");
      aiOutput = JSON.parse(cleanedText);
    } catch (aiErr: any) {
      console.warn("Falling back to gpt-oss-120b or basic parser:", aiErr.message);
      // Fallback attempt with openai/gpt-oss-120b
      const response = await generateText({
        model: groq("openai/gpt-oss-120b"),
        system: systemPrompt,
        prompt: `Meeting Notes / Transcript:\n\n${transcriptText}`,
        temperature: 0.2,
      });
      const cleanedText = response.text
        .trim()
        .replace(/^```json\s*/i, "")
        .replace(/```$/i, "");
      aiOutput = JSON.parse(cleanedText);
    }

    // Persist into database MeetingNote
    const savedNote = await upsertMeetingNote(eventId, {
      rawTranscript: transcriptText,
      summary: aiOutput.summary || "",
      decisions: aiOutput.decisions || "",
      followUpEmailDraft: aiOutput.followUpEmailDraft || "",
      actionItems: Array.isArray(aiOutput.actionItems) ? aiOutput.actionItems : [],
    });

    return NextResponse.json({
      success: true,
      data: savedNote,
      intelligence: aiOutput,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
