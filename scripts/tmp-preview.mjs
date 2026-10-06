import { PrismaClient } from "@prisma/client";
import { buildFollowUp, followUpSubject } from "../lib/interviews.js";
import { siteUrl } from "../lib/voice.js";
const p = new PrismaClient();
for (const slug of ["barbering-business", "airport-business-magazine"]) {
  const site = await p.site.findUnique({ where: { slug } });
  const es = await p.engineSetting.findMany({ where: { siteId: site.id, key: "interview_title_descriptor" } });
  const t = await p.interviewTarget.findFirst({ where: { siteId: site.id, status: "pending" } });
  const body = buildFollowUp({
    personName: t.personName, newsHook: t.newsHook, questions: t.questions,
    titleName: site.name, titleDescriptor: es[0]?.value || "", siteUrl: siteUrl(site),
    senderName: "James Burke", viaGeneric: true, firstContact: true,
  });
  console.log(`\n=========== ${site.name} -> ${t.personName}`);
  console.log("SUBJECT:", followUpSubject(t.company));
  console.log(body);
  console.log("EM/EN DASHES:", (body.match(/[—–]/g) || []).length);
}
await p.$disconnect();
