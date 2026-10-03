import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "Get Started",
  description: "Setup instructions for Peppermint Audio hire packages.",
  path: "/get-started",
  robots: {
    index: false,
    follow: false,
  },
});

const youtubeLinks = [
  {
    label: "Bose S1 Pro",
    query: "https://www.youtube.com/results?search_query=Bose+S1+Pro+setup",
  },
  {
    label: "Yamaha DXR15",
    query: "https://www.youtube.com/results?search_query=Yamaha+DXR15+setup",
  },
  {
    label: "Behringer Xenyx mixer",
    query: "https://www.youtube.com/results?search_query=Behringer+Xenyx+2+channel+mixer+setup",
  },
  {
    label: "PreSonus AIR15",
    query: "https://www.youtube.com/results?search_query=PreSonus+AIR15+setup",
  },
];

const packageGuides = [
  {
    id: "speech",
    title: "Speech & Presentation",
    equipment: "Bose S1 Pro + Wireless Microphone",
    steps: [
      "Place the Bose S1 Pro facing the audience and keep the microphone behind the speaker to help prevent feedback.",
      "Connect the wireless microphone receiver to the Bose S1 Pro.",
      "Turn on the receiver and microphone, then connect your phone by Bluetooth or AUX if you are playing background audio.",
    ],
  },
  {
    id: "small-budget",
    title: "Small Budget Event",
    equipment: "Bose S1 Pro",
    steps: [
      "Put the Bose speakers on stands, in front of the microphones, facing the audience.",
      "Connect the mixer MAIN OUT left and right to the inputs on the Bose speakers.",
      "Plug the wired microphone into a microphone channel on the mixer using an XLR cable.",
    ],
  },
  {
    id: "standard",
    title: "Standard Party & Events",
    equipment: "Yamaha DXR15",
    steps: [
      "Put the Yamaha speakers on stands, in front of the microphones, facing the audience.",
      "Connect the mixer MAIN OUT left and right to the inputs on the Yamaha speakers.",
      "Plug the wired microphone into a microphone channel on the mixer using an XLR cable.",
    ],
  },
  {
    id: "budget-boom",
    title: "Budget With A Boom",
    equipment: "Bose S1 Pro + Behringer B1200D Pro",
    steps: [
      "Put the Bose speakers on stands, with the Behringer subwoofer on the floor between them and facing the audience.",
      "Connect the mixer MAIN OUT to the subwoofer inputs, then connect the subwoofer outputs to the Bose speakers.",
      "Plug the wired microphone into a microphone channel on the mixer using an XLR cable.",
    ],
  },
  {
    id: "big",
    title: "Big Celebration",
    equipment: "Yamaha DXR15 + PreSonus AIR15",
    steps: [
      "Put the Yamaha speakers on stands and the AIR15 subwoofer on the floor between or near them.",
      "Connect the mixer MAIN OUT to the AIR15 inputs, then connect the AIR15 outputs to the Yamaha speakers.",
      "If included, connect the wireless microphone receiver outputs to microphone channels on the mixer.",
    ],
  },
];

export default function GetStartedPage() {
  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-14 sm:px-6 lg:px-8">
      <header className="max-w-2xl">
        <Badge variant="secondary">Peppermint Audio</Badge>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
          Set up your sound system
        </h1>
        <p className="mt-4 text-lg text-muted-foreground">
          Choose your package below, follow the three setup steps, then open the
          connection help only if you need it.
        </p>
      </header>

      <Card className="mt-10 border-primary/30 bg-primary/5">
        <CardContent className="grid gap-5 py-6 sm:grid-cols-3">
          {[
            ["1", "Choose your package", "Open the matching section below."],
            ["2", "Connect everything", "Keep all mixer levels turned down."],
            ["3", "Power on and play", "Mixer first, speakers last."],
          ].map(([number, title, description]) => (
            <div key={number} className="flex gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                {number}
              </span>
              <div>
                <p className="font-medium">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <section className="mt-14">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Choose your package
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Your setup</h2>
        </div>

        <Card className="border">
          <CardContent className="p-4 sm:p-6">
            <Accordion defaultValue={["speech"]}>
              {packageGuides.map((guide) => (
                <AccordionItem key={guide.id} value={guide.id}>
                  <AccordionTrigger className="py-4">
                    <span>
                      <span className="block text-base">{guide.title}</span>
                      <span className="mt-1 block text-sm font-normal text-muted-foreground">
                        {guide.equipment}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-4">
                    <ol className="space-y-3 text-sm text-muted-foreground">
                      {guide.steps.map((step, index) => (
                        <li key={step} className="flex gap-3">
                          <span className="font-medium text-foreground">{index + 1}.</span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14">
        <div className="mb-5">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Need a hand?
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">
            Connection help
          </h2>
          <p className="mt-2 text-muted-foreground">
            Open only the connection you are using.
          </p>
        </div>

        <Card className="border">
          <CardContent className="p-4 sm:p-6">
            <Accordion>
              <AccordionItem value="phone">
                <AccordionTrigger>Phone or AUX cable</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Connect your phone to the mixer&apos;s 3.5 mm stereo input with
                  the supplied AUX cable, then bring up that channel.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="bluetooth">
                <AccordionTrigger>Bluetooth receiver</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  Pair your phone with the supplied receiver. Connect its red and
                  white RCA outputs to the mixer&apos;s 3.5 mm stereo input using
                  the supplied RCA-to-3.5 mm cable.
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="microphone">
                <AccordionTrigger>Wired or wireless microphone</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  For a wired microphone, plug the XLR cable into a microphone
                  channel. For wireless microphones, connect the receiver outputs
                  to microphone channels, then switch on the receiver and microphones.
                  Keep the channel levels low while connecting.
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>
      </section>

      <section className="mt-14 grid gap-5 sm:grid-cols-2">
        <Card className="border">
          <CardHeader>
            <CardTitle>Power on and off</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Turn all mixer and speaker levels down before switching anything on.</p>
            <p>Power on the mixer first, then the speakers. Raise levels slowly.</p>
            <p>To finish, turn levels down, switch off the speakers, then the mixer.</p>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader>
            <CardTitle>Watch a quick video</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="mb-3 text-sm text-muted-foreground">
              Open a relevant YouTube search for your equipment.
            </p>
            {youtubeLinks.map((video) => (
              <Button
                key={video.label}
                variant="outline"
                className="w-full justify-between"
                nativeButton={false}
                render={<Link href={video.query} target="_blank" rel="noreferrer" />}
              >
                {video.label}
                <ExternalLink />
              </Button>
            ))}
          </CardContent>
        </Card>
      </section>

      <p className="mt-10 text-sm text-muted-foreground">
        If something does not match your equipment or a cable is missing, stop and
        contact Peppermint Audio before powering up.
      </p>
    </main>
  );
}
