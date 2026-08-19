-- Carry the wire item through from Researcher to Director, so a news topic
-- arrives with something to cite instead of being written as a sourceless
-- evergreen guide about a specific event.
ALTER TABLE "ResearchTopic" ADD COLUMN "sourceItemId" TEXT;
