// @ts-nocheck
/* eslint-disable */
import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { shouldShowScrollTop, scrollEverythingToTop } from "@/lib/scroll-top";
import { repairAndParse } from "@/lib/repairJson";
import { renderInlineMarkdown, inlineMarkdownToHtml } from "@/lib/inlineMarkdown";
import { useGlobalShortcuts, ShortcutsHelpOverlay } from "@/components/KeyboardShortcuts";
import { detectPII, PII_BLOCK_MESSAGE } from "@/lib/pii";
import { trackToolUse, setActiveTool as setActiveToolName } from "@/lib/tracking";
import { callAiRaw, generateImage } from "@/lib/aiFetch";
import { SpellTextarea, SpellInput } from "@/components/SpellCheckField";

const BANDS = {
  early:      { color:"#6D28D9", light:"#F5F3FF", emoji:"🌱", label:"Early Childhood" },
  elementary: { color:"#B45309", light:"#FFFBEB", emoji:"⭐", label:"Elementary"       },
  middle:     { color:"#0369A1", light:"#F0F9FF", emoji:"🏫", label:"Middle School"    },
  high:       { color:"#1E3A5F", light:"#EFF6FF", emoji:"🎓", label:"High School"      },
};

const GRADES = [
  { id:"pk", name:"Pre-K",    short:"PK", band:"early",      fontSize:14, lineH:32 },
  { id:"k",  name:"Kinder.",  short:"K",  band:"early",      fontSize:14, lineH:32 },
  { id:"1",  name:"Grade 1",  short:"1",  band:"early",      fontSize:14, lineH:32 },
  { id:"2",  name:"Grade 2",  short:"2",  band:"early",      fontSize:14, lineH:32 },
  { id:"3",  name:"Grade 3",  short:"3",  band:"elementary", fontSize:14, lineH:32 },
  { id:"4",  name:"Grade 4",  short:"4",  band:"elementary", fontSize:14, lineH:32 },
  { id:"5",  name:"Grade 5",  short:"5",  band:"elementary", fontSize:14, lineH:32 },
  { id:"6",  name:"Grade 6",  short:"6",  band:"middle",     fontSize:14, lineH:32 },
  { id:"7",  name:"Grade 7",  short:"7",  band:"middle",     fontSize:14, lineH:32 },
  { id:"8",  name:"Grade 8",  short:"8",  band:"middle",     fontSize:14, lineH:32 },
  { id:"9",  name:"Grade 9",  short:"9",  band:"high",       fontSize:14, lineH:32 },
  { id:"10", name:"Grade 10", short:"10", band:"high",       fontSize:14, lineH:32 },
  { id:"11", name:"Grade 11", short:"11", band:"high",       fontSize:14, lineH:32 },
  { id:"12", name:"Grade 12", short:"12", band:"high",       fontSize:14, lineH:32 },
];

const gInfo = (id) => {
  const g = GRADES.find(x => x.id === id) || GRADES[1];
  return { ...g, ...BANDS[g.band] };
};

const NY_STANDARDS = {
  "ELA": {
    "Kindergarten": [
      { code:"KR1",   desc:"Develop and answer questions about a text (RI&RL)" },
      { code:"KR2",   desc:"Retell stories or share key details from a text (RI&RL)" },
      { code:"KR3",   desc:"Identify characters, settings, and major events in a story, or pieces of information in a text (RI&RL)" },
      { code:"KR4",   desc:"Identify specific words that express feelings and senses (RI&RL)" },
      { code:"KR5",   desc:"Identify literary and informational texts (RI&RL)" },
      { code:"KR6",   desc:"Name the author and illustrator and define the role of each in presenting the ideas in a text (RI&RL)" },
      { code:"KR7",   desc:"Describe the relationship between illustrations and the text (RI&RL)" },
      { code:"KR8",   desc:"Identify specific information to support ideas in a text (RI&RL)" },
      { code:"KR9",   desc:"Make connections between self, text, and the world (RI&RL)" },
      { code:"KRF1",  desc:"Demonstrate understanding of the organization and basic features of print — follow words left to right, recognize letters of the alphabet, understand that words are separated by spaces" },
      { code:"KRF2",  desc:"Demonstrate understanding of spoken words, syllables, and sounds — recognize and produce rhyming words, blend and segment syllables, blend and segment individual phonemes" },
      { code:"KRF3",  desc:"Know and apply grade-level phonics and word analysis skills — letter-sound correspondence, decode short vowel sounds, read common high-frequency words by sight" },
      { code:"KRF4",  desc:"Engage with emergent level texts and read-alouds to demonstrate comprehension (Fluency)" },
      { code:"KW1",   desc:"Use drawing, dictating, oral expression, and/or emergent writing to state an opinion about a familiar topic or personal experience and give a reason" },
      { code:"KW2",   desc:"Use drawing, dictating, oral expression, and/or emergent writing to name a familiar topic and supply information" },
      { code:"KW3",   desc:"Use drawing, dictating, oral expression, and/or emergent writing to narrate an event or events in a sequence" },
      { code:"KW4",   desc:"Create a response to a text, author, or personal experience (e.g., dramatization, artwork, or poem)" },
      { code:"KW6",   desc:"Develop questions and participate in shared research and exploration to answer questions and to build and share knowledge" },
      { code:"KW7",   desc:"Recall and represent relevant information from experiences or gather information from provided sources to answer a question (drawing, oral expression, emergent writing)" },
      { code:"KSL1",  desc:"Participate in collaborative conversations with diverse peers and adults in small and large groups — follow agreed-upon rules, take turns, stay on topic" },
      { code:"KSL2",  desc:"Participate in a conversation about features of diverse texts and formats" },
      { code:"KSL3",  desc:"Develop and answer questions to clarify what the speaker says" },
      { code:"KSL4",  desc:"Describe familiar people, places, things, and events with detail" },
      { code:"KSL5",  desc:"Create and/or utilize existing visual displays to support descriptions" },
      { code:"KSL6",  desc:"Express thoughts, feelings, and ideas" },
      { code:"KL4",   desc:"Explore and use new vocabulary and multiple-meaning words and phrases in authentic experiences, including using inflections and affixes as clues to meaning" },
      { code:"KL5",   desc:"Explore and discuss word relationships and word meanings — sort objects into categories, use words to identify and describe the world, explore verb variations" },
      { code:"KL6",   desc:"Use words and phrases acquired through conversations, reading, and being read to, and responding to texts" },
    ],
    "Grade 1": [
      { code:"1R1",   desc:"Develop and answer questions about key ideas and details in a text (RI&RL)" },
      { code:"1R2",   desc:"Identify a main topic or central idea in a text and retell important details (RI&RL)" },
      { code:"1R3",   desc:"Describe characters, settings, and major events in a story, or pieces of information in a text (RI&RL)" },
      { code:"1R4",   desc:"Identify specific words that express feelings and senses (RI&RL)" },
      { code:"1R5",   desc:"Identify a variety of genres and explain major differences between literary and informational texts (RI&RL)" },
      { code:"1R6",   desc:"Describe how illustrations and details support the point of view or purpose of the text (RI&RL)" },
      { code:"1R7",   desc:"Use illustrations and details in literary and informational texts to discuss story elements and/or topics (RI&RL)" },
      { code:"1R8",   desc:"Identify specific information an author or illustrator gives that supports ideas in a text (RI&RL)" },
      { code:"1R9",   desc:"Make connections between self and text (RI&RL)" },
      { code:"1RF1",  desc:"Demonstrate understanding of organization and basic features of print — recognize distinguishing features of a sentence (Print Concepts)" },
      { code:"1RF2",  desc:"Demonstrate understanding of spoken words, syllables, and sounds — count, blend and segment single-syllable words including consonant blends; manipulate individual phonemes" },
      { code:"1RF3",  desc:"Know and apply phonics and word analysis skills — consonant blends, digraphs, long vowel sounds, two-syllable words, root words and simple suffixes, high-frequency words" },
      { code:"1RF4",  desc:"Read beginning reader texts with accuracy, appropriate rate, and expression; use context to confirm or self-correct word recognition (Fluency)" },
      { code:"1W1",   desc:"Write an opinion on a topic or personal experience; give two or more reasons to support that opinion" },
      { code:"1W2",   desc:"Write an informative/explanatory text to introduce a topic, supplying some facts to develop points, and provide some sense of closure" },
      { code:"1W3",   desc:"Write narratives which recount real or imagined experiences or a short sequence of events" },
      { code:"1W4",   desc:"Create a response to a text, author, theme or personal experience (e.g., poem, dramatization, artwork)" },
      { code:"1W6",   desc:"Develop questions and participate in shared research and explorations to answer questions and to build knowledge" },
      { code:"1W7",   desc:"Recall and represent relevant information from experiences or gather information from provided sources to answer a question" },
      { code:"1SL1",  desc:"Participate in collaborative conversations — follow rules for discussion, build on others' talk, listen actively, take turns, stay on topic" },
      { code:"1SL2",  desc:"Participate in a conversation about features of diverse texts and formats" },
      { code:"1SL3",  desc:"Develop and answer questions about what a speaker says" },
      { code:"1SL4",  desc:"Describe people, places, things, and events with relevant details, expressing ideas and feelings clearly" },
      { code:"1SL5",  desc:"Include digital media and/or visual displays in presentations to clarify ideas" },
      { code:"1SL6",  desc:"Express thoughts, feelings, and ideas clearly, adapting language according to context" },
      { code:"1L4",   desc:"Determine or clarify the meaning of unknown and multiple-meaning words and phrases — use sentence-level context, identify root words, use affixes as clues" },
      { code:"1L5",   desc:"Demonstrate understanding of word relationships and nuances — sort objects into categories, identify real-life connections, distinguish shades of meaning among verbs" },
    ],
    "Grade 2": [
      { code:"2R1",   desc:"Develop and answer questions to demonstrate understanding of key ideas and details in a text (RI&RL)" },
      { code:"2R2",   desc:"Identify a main topic or central idea and retell key details; summarize portions of a text (RI&RL)" },
      { code:"2R3",   desc:"Describe how characters respond to major events and challenges in a literary text (RL)" },
      { code:"2R4",   desc:"Explain how words and phrases suggest feelings and appeal to the senses (RI&RL)" },
      { code:"2R5",   desc:"Describe the overall structure of a story including beginning, middle, and end (RL)" },
      { code:"2R6",   desc:"Acknowledge differences in points of view of characters and authors (RI&RL)" },
      { code:"2R7",   desc:"Use information from illustrations and words to demonstrate understanding of characters, settings, or plot (RI&RL)" },
      { code:"2R8",   desc:"Identify specific information authors include that supports ideas in a text (RI&RL)" },
      { code:"2R9",   desc:"Make connections between self and text; compare and contrast two texts on the same topic (RI&RL)" },
      { code:"2RF3",  desc:"Know and apply phonics and word analysis skills — decode regularly spelled two-syllable words, recognize common prefixes and suffixes, decode words with common Latin suffixes" },
      { code:"2RF4",  desc:"Read grade-level text with sufficient accuracy and fluency to support comprehension; use context to self-correct" },
      { code:"2W1",   desc:"Write an opinion about a topic or personal experience, stating the opinion with reasons and a concluding statement" },
      { code:"2W2",   desc:"Write informative/explanatory texts to introduce a topic, use facts and definitions, and provide a concluding statement" },
      { code:"2W3",   desc:"Write narratives recounting real or imagined experiences using details, temporal words, and a sense of closure" },
      { code:"2W4",   desc:"Create a response to a text, author, theme or personal experience (e.g., poem, play, story, artwork)" },
      { code:"2W6",   desc:"Develop questions and participate in shared research and explorations to answer questions and build knowledge" },
      { code:"2W7",   desc:"Recall and represent relevant information from experiences or gather information from provided sources to answer a question" },
      { code:"2SL1",  desc:"Participate in collaborative conversations — follow rules, build on others' talk, ask for clarification, consider individual differences" },
      { code:"2SL2",  desc:"Recount or describe key ideas or details of diverse texts and formats" },
      { code:"2SL3",  desc:"Develop and answer questions about what a speaker says; agree or disagree with the speaker's point of view" },
      { code:"2SL4",  desc:"Describe people, places, things, and events with relevant details, expressing ideas and feelings clearly" },
      { code:"2SL5",  desc:"Include digital media and/or visual displays in presentations to clarify or support ideas" },
      { code:"2L3",   desc:"Use knowledge of language and its conventions when writing, speaking, reading, or listening; compare academic and conversational English" },
      { code:"2L4",   desc:"Determine or clarify the meaning of unknown and multiple-meaning words — context clues, prefixes, root words, compound words, glossaries" },
      { code:"2L5",   desc:"Demonstrate understanding of word relationships — real-life connections, shades of meaning among closely related verbs and adjectives" },
    ],
    "Grades 3 – 5": [
      { code:"3R1",   desc:"Develop and answer questions to locate relevant and specific details in a text to support an answer or inference (Gr 3)" },
      { code:"3R2",   desc:"Determine a theme or central idea and explain how it is supported by key details; summarize a text (Gr 3)" },
      { code:"3R3",   desc:"Describe character traits, motivations, or feelings drawing on specific details in a literary text (Gr 3)" },
      { code:"3R4",   desc:"Determine the meaning of words and phrases as they are used in a text, distinguishing literal from nonliteral language (Gr 3)" },
      { code:"3R6",   desc:"Distinguish their own point of view from that of the author or narrator of a text (Gr 3)" },
      { code:"3W1",   desc:"Write an argument to support claims using clear reasons and relevant evidence (Gr 3)" },
      { code:"3W2",   desc:"Write informative/explanatory texts to explore a topic and convey ideas and information (Gr 3)" },
      { code:"3W3",   desc:"Write narratives to develop real or imagined experiences using effective techniques, descriptive details, and clear event sequences (Gr 3)" },
      { code:"3SL1",  desc:"Engage effectively in collaborative discussions, expressing ideas clearly, building on others' ideas (Gr 3)" },
      { code:"4R1",   desc:"Locate and refer to relevant details and evidence when explaining what a text says explicitly/implicitly and when making logical inferences (Gr 4)" },
      { code:"4R2",   desc:"Determine a theme or central idea of a text and explain how it is supported by key details; summarize the text (Gr 4)" },
      { code:"4R3",   desc:"Describe a character, setting, or event in a literary text drawing on specific details in the text (Gr 4)" },
      { code:"4R6",   desc:"Compare and contrast the point of view from which different stories are narrated, including first- and third-person narrations (Gr 4)" },
      { code:"4W1",   desc:"Write arguments to support claims using clear reasons and relevant evidence with a precise claim organized logically (Gr 4)" },
      { code:"4W2",   desc:"Write informative/explanatory texts to explore a topic and convey ideas and information (Gr 4)" },
      { code:"4W5",   desc:"Draw evidence from literary or informational texts to support analysis, reflection, and research (Gr 4)" },
      { code:"4SL1",  desc:"Engage effectively in collaborative discussions; come prepared, follow agreed-upon norms, link comments to remarks of others (Gr 4)" },
      { code:"5R1",   desc:"Locate and refer to relevant details and evidence when explaining what a text says explicitly/implicitly and when making logical inferences (Gr 5)" },
      { code:"5R2",   desc:"Determine a theme or central idea and explain how it is supported by key details; summarize the text (Gr 5)" },
      { code:"5R3",   desc:"Compare and contrast two or more characters, settings, and events in a story or drama, drawing on specific details (Gr 5)" },
      { code:"5W1",   desc:"Write arguments to support claims with clear reasons and relevant evidence (Gr 5)" },
      { code:"5W2",   desc:"Write informative/explanatory texts to examine a topic and convey ideas and information (Gr 5)" },
      { code:"5SL1",  desc:"Engage effectively in a range of collaborative discussions with diverse partners on grade-level topics and texts (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"6R1",   desc:"Cite textual evidence to support analysis of what the text says explicitly/implicitly and make logical inferences (Gr 6)" },
      { code:"6R2",   desc:"Determine a theme or central idea of a text and how it is developed by key supporting details; summarize a text (Gr 6)" },
      { code:"6R3",   desc:"Describe how events unfold and how characters respond or change as the plot moves toward resolution (Gr 6)" },
      { code:"6R4",   desc:"Determine the meaning of words and phrases including figurative and connotative meanings; analyze impact of word choices (Gr 6)" },
      { code:"6R8",   desc:"Trace and evaluate the development of an argument and specific claims in texts; assess whether reasoning is valid and evidence sufficient (Gr 6)" },
      { code:"6W1",   desc:"Write arguments to support claims with clear reasons and relevant evidence (Gr 6)" },
      { code:"6W2",   desc:"Write informative/explanatory texts to examine a topic and convey ideas and concepts (Gr 6)" },
      { code:"6SL1",  desc:"Engage effectively in collaborative discussions — come prepared, follow norms, build on others' ideas, ask questions (Gr 6)" },
      { code:"7R1",   desc:"Cite several pieces of textual evidence to support analysis of what the text says explicitly/implicitly (Gr 7)" },
      { code:"7R2",   desc:"Determine a theme or central idea and analyze its development; provide an objective summary (Gr 7)" },
      { code:"7R4",   desc:"Determine the meaning of words and phrases including figurative, connotative, and technical meanings (Gr 7)" },
      { code:"7W1",   desc:"Write arguments to support claims with clear reasons and relevant evidence; acknowledge counterclaims (Gr 7)" },
      { code:"7W2",   desc:"Write informative/explanatory texts to examine a topic and convey ideas, concepts, and information (Gr 7)" },
      { code:"7SL1",  desc:"Engage effectively in collaborative discussions; pose and respond to questions, link comments, acknowledge new information (Gr 7)" },
      { code:"8R1",   desc:"Cite the textual evidence that most strongly supports an analysis of what the text says explicitly/implicitly (Gr 8)" },
      { code:"8R2",   desc:"Determine a theme or central idea of a text and analyze its development; provide an objective summary (Gr 8)" },
      { code:"8W1",   desc:"Write arguments to support claims with clear reasons and relevant evidence; distinguish claims from counterclaims (Gr 8)" },
      { code:"8W2",   desc:"Write informative/explanatory texts to examine a topic and convey ideas, concepts, and information (Gr 8)" },
      { code:"8SL4",  desc:"Present claims and findings, emphasizing salient points in a focused, coherent manner with relevant evidence and sound reasoning (Gr 8)" },
    ],
    "Grades 9 – 12": [
      { code:"9-10R1",  desc:"Cite strong and thorough textual evidence to support analysis; develop questions for deeper understanding and further exploration (Gr 9-10)" },
      { code:"9-10R2",  desc:"Determine one or more themes or central ideas and analyze its development; objectively and accurately summarize a text (Gr 9-10)" },
      { code:"9-10R3",  desc:"Analyze how complex characters develop, interact, advance the plot, or develop a theme (Gr 9-10)" },
      { code:"9-10R4",  desc:"Determine the meaning of words and phrases including figurative and connotative meanings; examine technical terms and how language differs across genres (Gr 9-10)" },
      { code:"9-10W1",  desc:"Write arguments to support claims using valid reasoning and relevant and sufficient evidence from credible sources (Gr 9-10)" },
      { code:"9-10W2",  desc:"Write informative/explanatory texts to examine and convey complex ideas, concepts, and information (Gr 9-10)" },
      { code:"9-10SL1", desc:"Initiate and participate effectively in collaborative discussions; come prepared, refer to evidence, respond thoughtfully, qualify or justify views (Gr 9-10)" },
      { code:"11-12R1", desc:"Cite strong and thorough textual evidence including determining where the text leaves matters uncertain; develop questions for deeper understanding (Gr 11-12)" },
      { code:"11-12R2", desc:"Determine two or more themes or central ideas and analyze their development and how they interact and build on each other (Gr 11-12)" },
      { code:"11-12W1", desc:"Write arguments to support claims using valid reasoning and relevant and sufficient evidence; use sophisticated style and structure (Gr 11-12)" },
      { code:"11-12W2", desc:"Write informative/explanatory texts to examine and convey complex ideas, concepts, and information clearly and accurately (Gr 11-12)" },
      { code:"11-12SL1",desc:"Initiate and participate effectively in collaborative discussions; propel conversations by posing questions that probe reasoning and evidence (Gr 11-12)" },
    ],
  },
  "Math": {
    "Kindergarten": [
      { code:"NY-K.CC.1",   desc:"Count to 100 by ones and by tens; count to 100 by ones beginning from any given number" },
      { code:"NY-K.CC.2",   desc:"Count forward beginning from a given number within 100 instead of beginning at 1" },
      { code:"NY-K.CC.3",   desc:"Write numbers from 0 to 20; represent a number of objects with a written numeral 0–20" },
      { code:"NY-K.CC.4",   desc:"Understand the relationship between numbers and quantities up to 20; connect counting to cardinality — 1:1 correspondence, cardinality, ordinal numbers first through tenth" },
      { code:"NY-K.CC.5",   desc:"Answer counting questions using as many as 20 objects in a line, rectangular array, or circle; count out a given number from 1–20" },
      { code:"NY-K.CC.6",   desc:"Identify whether the number of objects in one group is greater than, less than, or equal to another group (up to 10 objects)" },
      { code:"NY-K.CC.7",   desc:"Compare two numbers between 1 and 10 presented as written numerals" },
      { code:"NY-K.OA.1",   desc:"Represent addition and subtraction using objects, fingers, pennies, drawings, sounds, acting out situations, verbal explanations, expressions, or equations" },
      { code:"NY-K.OA.2",   desc:"Add and subtract within 10; solve addition and subtraction word problems within 10 using objects or drawings" },
      { code:"NY-K.OA.3",   desc:"Decompose numbers less than or equal to 10 into pairs in more than one way using objects or drawings; record with a drawing or equation" },
      { code:"NY-K.OA.4",   desc:"Find the number that makes 10 when given a number from 1 to 9; record the answer with a drawing or equation" },
      { code:"NY-K.OA.5",   desc:"Fluently add and subtract within 5" },
      { code:"NY-K.OA.6",   desc:"Duplicate, extend, and create simple patterns using concrete objects" },
      { code:"NY-K.NBT.1",  desc:"Compose and decompose the numbers from 11 to 19 into ten ones and one to nine additional ones using objects or drawings" },
      { code:"NY-K.MD.1",   desc:"Describe measurable attributes of an object such as length or weight using appropriate vocabulary (small, big, short, tall, empty, full, heavy, light)" },
      { code:"NY-K.MD.2",   desc:"Directly compare two objects with a common measurable attribute and describe the difference" },
      { code:"NY-K.MD.3",   desc:"Classify objects into given categories; count the objects in each category and sort the categories by count (limit counts to 10 or less)" },
      { code:"NY-K.MD.4",   desc:"Explore coins — pennies, nickels, dimes, and quarters — and begin identifying pennies and dimes" },
      { code:"NY-K.G.1",    desc:"Describe objects in the environment using names of shapes; describe relative positions using terms such as above, below, beside, in front of, behind, and next to" },
      { code:"NY-K.G.2",    desc:"Name shapes regardless of their orientation or overall size (squares, circles, triangles, rectangles, hexagons, cubes, cones, cylinders, and spheres)" },
      { code:"NY-K.G.3",    desc:"Understand the difference between two-dimensional (flat) and three-dimensional (solid) shapes" },
      { code:"NY-K.G.4",    desc:"Analyze, compare, and sort two- and three-dimensional shapes using informal language to describe their similarities, differences, parts, and other attributes" },
      { code:"NY-K.G.5",    desc:"Model objects in their environment by building and/or drawing shapes" },
      { code:"NY-K.G.6",    desc:"Compose simple shapes to form larger shapes" },
    ],
    "Grade 1": [
      { code:"NY-1.OA.1",   desc:"Use addition and subtraction within 20 to solve one-step word problems involving adding to, taking from, putting together, taking apart, and comparing, with unknowns in all positions" },
      { code:"NY-1.OA.2",   desc:"Solve word problems calling for addition of three whole numbers whose sum is less than or equal to 20, using objects, drawings, or equations" },
      { code:"NY-1.OA.3",   desc:"Apply properties of operations as strategies to add and subtract (commutative and associative properties)" },
      { code:"NY-1.OA.4",   desc:"Understand subtraction as an unknown-addend problem within 20" },
      { code:"NY-1.OA.5",   desc:"Relate counting to addition and subtraction (e.g., by counting on 2 to add 2)" },
      { code:"NY-1.OA.6",   desc:"Add and subtract within 20 using strategies (counting on, making ten, decomposing, relationship between addition and subtraction); fluently add and subtract within 10" },
      { code:"NY-1.OA.7",   desc:"Understand the meaning of the equal sign; determine if equations involving addition and subtraction are true or false" },
      { code:"NY-1.OA.8",   desc:"Determine the unknown whole number in an addition or subtraction equation with the unknown in all positions" },
      { code:"NY-1.NBT.1",  desc:"Count to 120 starting at any number less than 120; read and write numerals and represent a number of objects with a written numeral" },
      { code:"NY-1.NBT.2",  desc:"Understand that the two digits of a two-digit number represent amounts of tens and ones; understand 10 as a bundle of ten ones; understand teen numbers and multiples of 10" },
      { code:"NY-1.NBT.3",  desc:"Compare two two-digit numbers based on meanings of tens and ones digits using >, =, and < symbols" },
      { code:"NY-1.NBT.4",  desc:"Add within 100 including a two-digit number and a one-digit number, and a two-digit number and a multiple of 10; use concrete models or drawings and place-value strategies" },
      { code:"NY-1.NBT.5",  desc:"Mentally find 10 more or 10 less than a two-digit number without counting; explain the reasoning used" },
      { code:"NY-1.NBT.6",  desc:"Subtract multiples of 10 from multiples of 10 in the range 10–90 using concrete models, drawings, and place-value strategies" },
      { code:"NY-1.MD.1",   desc:"Order three objects by length; compare the lengths of two objects indirectly by using a third object" },
      { code:"NY-1.MD.2",   desc:"Measure the length of an object using same-size length units placed end to end with no gaps or overlaps; express length as a whole number of length units" },
      { code:"NY-1.MD.3",   desc:"Tell and write time in hours and half-hours using analog and digital clocks; identify coins (penny, nickel, dime, quarter) and their values; count mixed collections of dimes and pennies" },
      { code:"NY-1.MD.4",   desc:"Organize, represent, and interpret data with up to three categories; ask and answer questions about total data points, how many in each category, and how many more or less" },
      { code:"NY-1.G.1",    desc:"Distinguish between defining and non-defining attributes of shapes; build and/or draw shapes to possess defining attributes" },
      { code:"NY-1.G.2",    desc:"Compose two-dimensional and three-dimensional shapes to create composite shapes; compose new shapes from composite shapes" },
      { code:"NY-1.G.3",    desc:"Partition circles and rectangles into two and four equal shares; describe shares using halves, fourths, and quarters; describe the whole as two of or four of the shares" },
    ],
    "Grade 2": [
      { code:"NY-2.OA.1",   desc:"Use addition and subtraction within 100 to solve one- and two-step word problems involving adding to, taking from, putting together, taking apart, and comparing, with unknowns in all positions" },
      { code:"NY-2.OA.2",   desc:"Fluently add and subtract within 20 using mental strategies; know from memory all sums within 20 of two one-digit numbers" },
      { code:"NY-2.OA.3",   desc:"Determine whether a group of objects (up to 20) has an odd or even number of members; write an equation to express an even number as a sum of two equal addends" },
      { code:"NY-2.OA.4",   desc:"Use addition to find the total number of objects in rectangular arrays with up to 5 rows and 5 columns; write an equation to express the total as a sum of equal addends" },
      { code:"NY-2.NBT.1",  desc:"Understand that the three digits of a three-digit number represent hundreds, tens, and ones; understand 100 as a bundle of ten tens" },
      { code:"NY-2.NBT.2",  desc:"Count within 1000; skip-count by 5s, 10s, and 100s" },
      { code:"NY-2.NBT.3",  desc:"Read and write numbers to 1000 using base-ten numerals, number names, and expanded form" },
      { code:"NY-2.NBT.4",  desc:"Compare two three-digit numbers using >, =, and < symbols" },
      { code:"NY-2.NBT.5",  desc:"Fluently add and subtract within 100 using strategies based on place value, properties of operations, and/or the relationship between addition and subtraction" },
      { code:"NY-2.NBT.7",  desc:"Add and subtract within 1000 using concrete models or drawings and strategies based on place value, properties of operations, and/or the relationship between addition and subtraction" },
      { code:"NY-2.NBT.8",  desc:"Mentally add 10 or 100 to a given number 100–900; mentally subtract 10 or 100 from a given number 100–900" },
      { code:"NY-2.MD.1",   desc:"Measure the length of an object to the nearest whole unit using appropriate tools such as rulers, yardsticks, meter sticks, and measuring tapes" },
      { code:"NY-2.MD.4",   desc:"Measure to determine how much longer one object is than another, expressing the difference in terms of a standard length unit" },
      { code:"NY-2.MD.5",   desc:"Use addition and subtraction within 100 to solve word problems involving lengths given in the same units" },
      { code:"NY-2.MD.6",   desc:"Represent whole numbers as lengths from 0 on a number line; represent whole-number sums and differences within 100 on a number line" },
      { code:"NY-2.MD.7",   desc:"Tell and write time from analog and digital clocks in five-minute increments using a.m. and p.m. (quarter past, half past, quarter to)" },
      { code:"NY-2.MD.8",   desc:"Count a mixed collection of coins up to one dollar; solve real-world problems within one dollar involving quarters, dimes, nickels, and pennies" },
      { code:"NY-2.MD.9",   desc:"Generate measurement data by measuring lengths of objects to the nearest whole unit; present data in a line plot with whole-number units" },
      { code:"NY-2.MD.10",  desc:"Draw a picture graph and bar graph to represent a data set with up to four categories; solve put-together, take-apart, and compare problems using graphs" },
      { code:"NY-2.G.1",    desc:"Classify two-dimensional figures as polygons or non-polygons" },
      { code:"NY-2.G.2",    desc:"Partition a rectangle into rows and columns of same-size squares; count to find the total number" },
      { code:"NY-2.G.3",    desc:"Partition circles and rectangles into two, three, or four equal shares; describe shares using halves, thirds, fourths; recognize that equal shares of identical wholes need not have the same shape" },
    ],
    "Grades 3 – 5": [
      { code:"NY-3.OA.1",   desc:"Interpret products of whole numbers as the total number of objects in equal groups (Gr 3)" },
      { code:"NY-3.OA.2",   desc:"Interpret whole-number quotients of whole numbers as a number of objects in each share or as a number of equal shares (Gr 3)" },
      { code:"NY-3.OA.3",   desc:"Use multiplication and division within 100 to solve word problems involving equal groups, arrays, and measurement quantities (Gr 3)" },
      { code:"NY-3.OA.7",   desc:"Fluently solve single-digit multiplication and related divisions using strategies; know from memory all products of two one-digit numbers (Gr 3)" },
      { code:"NY-3.OA.8",   desc:"Solve two-step word problems using the four operations; represent using equations with a letter for the unknown; assess reasonableness using estimation (Gr 3)" },
      { code:"NY-3.NBT.1",  desc:"Use place value understanding to round whole numbers to the nearest 10 or 100 (Gr 3)" },
      { code:"NY-3.NBT.2",  desc:"Fluently add and subtract within 1,000 using strategies and algorithms based on place value, properties of operations, and/or relationship between addition and subtraction (Gr 3)" },
      { code:"NY-3.NBT.3",  desc:"Multiply one-digit whole numbers by multiples of 10 in the range 10–90 using place value strategies (Gr 3)" },
      { code:"NY-3.NF.1",   desc:"Understand a unit fraction 1/b as one part when a whole is partitioned into b equal parts; understand a/b as a parts of size 1/b (Gr 3)" },
      { code:"NY-3.NF.2",   desc:"Understand a fraction as a number on the number line; represent fractions on a number line (Gr 3)" },
      { code:"NY-3.NF.3",   desc:"Explain equivalence of fractions; compare fractions with the same numerator or denominator by reasoning about size (Gr 3)" },
      { code:"NY-3.MD.3",   desc:"Draw a scaled picture graph and bar graph to represent data with several categories; solve problems using information in graphs (Gr 3)" },
      { code:"NY-3.MD.5",   desc:"Recognize area as an attribute of plane figures; understand concepts of area measurement (Gr 3)" },
      { code:"NY-3.MD.7",   desc:"Relate area to multiplication and addition; find area of rectangles using multiplication; solve real-world problems involving area (Gr 3)" },
      { code:"NY-3.MD.8",   desc:"Solve real-world problems involving perimeters of polygons; find an unknown side length; exhibit rectangles with the same area and different perimeters (Gr 3)" },
      { code:"NY-3.G.1",    desc:"Classify polygons including quadrilaterals, pentagons, hexagons, and triangles; understand that shapes in different categories may share attributes (Gr 3)" },
      { code:"NY-4.OA.1",   desc:"Interpret a multiplication equation as a comparison; represent verbal statements of multiplicative comparisons as equations (Gr 4)" },
      { code:"NY-4.OA.3",   desc:"Solve multistep word problems using the four operations including problems where remainders must be interpreted; assess reasonableness using estimation (Gr 4)" },
      { code:"NY-4.NBT.4",  desc:"Fluently add and subtract multi-digit whole numbers using the standard algorithm (Gr 4)" },
      { code:"NY-4.NBT.5",  desc:"Multiply a whole number up to four digits by a one-digit number and multiply two two-digit numbers using strategies based on place value and properties of operations (Gr 4)" },
      { code:"NY-4.NBT.6",  desc:"Find whole-number quotients and remainders with up to four-digit dividends and one-digit divisors using strategies based on place value and properties of operations (Gr 4)" },
      { code:"NY-4.NF.1",   desc:"Explain why a fraction a/b is equivalent to (n×a)/(n×b) using visual fraction models; recognize and generate equivalent fractions (Gr 4)" },
      { code:"NY-4.NF.3",   desc:"Understand a fraction a/b with a > 1 as a sum of fractions 1/b; add and subtract mixed numbers with like denominators; solve word problems involving addition and subtraction of fractions (Gr 4)" },
      { code:"NY-4.NF.4",   desc:"Apply and extend understanding of multiplication to multiply a fraction by a whole number; solve word problems involving multiplication of a fraction by a whole number (Gr 4)" },
      { code:"NY-4.MD.3",   desc:"Apply area and perimeter formulas for rectangles in real-world and mathematical problems (Gr 4)" },
      { code:"NY-4.G.1",    desc:"Draw points, lines, line segments, rays, angles, and perpendicular and parallel lines; identify these in two-dimensional figures (Gr 4)" },
      { code:"NY-5.OA.1",   desc:"Write and interpret numerical expressions using parentheses, brackets, or braces; evaluate expressions (Gr 5)" },
      { code:"NY-5.NBT.1",  desc:"Recognize that a digit in one place represents 10 times as much as in the place to its right and 1/10 of what it represents in the place to its left (Gr 5)" },
      { code:"NY-5.NBT.5",  desc:"Fluently multiply multi-digit whole numbers using the standard algorithm (Gr 5)" },
      { code:"NY-5.NBT.7",  desc:"Add, subtract, multiply, and divide decimals to hundredths using concrete models or drawings; relate the strategy to a written method (Gr 5)" },
      { code:"NY-5.NF.1",   desc:"Add and subtract fractions with unlike denominators including mixed numbers; use benchmark fractions to estimate reasonableness (Gr 5)" },
      { code:"NY-5.NF.4",   desc:"Apply and extend understanding of multiplication to multiply a fraction or whole number by a fraction; find area of rectangles with fractional side lengths (Gr 5)" },
      { code:"NY-5.MD.3",   desc:"Recognize volume as an attribute of solid figures; understand a unit cube and concepts of volume measurement (Gr 5)" },
      { code:"NY-5.MD.5",   desc:"Relate volume to multiplication and addition; solve real-world problems involving volume of rectangular prisms (Gr 5)" },
      { code:"NY-5.G.1",    desc:"Use a pair of perpendicular number lines to define a coordinate system; graph points in the first quadrant and interpret coordinate values (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"NY-6.RP.1",   desc:"Understand the concept of a ratio and use ratio language to describe a ratio relationship between two quantities (Gr 6)" },
      { code:"NY-6.RP.2",   desc:"Understand the concept of a unit rate a/b associated with a ratio a:b and use rate language in the context of a ratio relationship (Gr 6)" },
      { code:"NY-6.RP.3",   desc:"Use ratio and rate reasoning to solve real-world and mathematical problems including tables of equivalent ratios, tape diagrams, double number lines, and equations (Gr 6)" },
      { code:"NY-6.NS.1",   desc:"Interpret and compute quotients of fractions; solve real-world word problems involving division of fractions by fractions (Gr 6)" },
      { code:"NY-6.NS.5",   desc:"Understand that positive and negative numbers describe quantities having opposite directions or values; use positive and negative numbers to represent real-world quantities (Gr 6)" },
      { code:"NY-6.NS.6",   desc:"Understand a rational number as a point on the number line; extend number line and coordinate axes to include negative numbers (Gr 6)" },
      { code:"NY-6.EE.1",   desc:"Write and evaluate numerical expressions involving whole-number exponents (Gr 6)" },
      { code:"NY-6.EE.2",   desc:"Write, read, and evaluate expressions in which letters stand for numbers; write expressions that record operations with numbers and letters (Gr 6)" },
      { code:"NY-6.EE.5",   desc:"Understand solving equations and inequalities as a process of answering which values make the equation or inequality true (Gr 6)" },
      { code:"NY-6.EE.7",   desc:"Solve real-world and mathematical problems by writing and solving equations of the form x+p=q and px=q for non-negative rational numbers (Gr 6)" },
      { code:"NY-6.G.1",    desc:"Find area of right triangles, other triangles, special quadrilaterals, and polygons by composing into rectangles or decomposing into triangles and other shapes (Gr 6)" },
      { code:"NY-6.SP.1",   desc:"Recognize a statistical question as one that anticipates variability in the data related to the question; understand statistics as a process for making inferences (Gr 6)" },
      { code:"NY-7.RP.1",   desc:"Compute unit rates associated with ratios of fractions, including ratios of lengths, areas, and other quantities (Gr 7)" },
      { code:"NY-7.RP.2",   desc:"Recognize and represent proportional relationships between quantities; decide whether two quantities are in a proportional relationship (Gr 7)" },
      { code:"NY-7.RP.3",   desc:"Use proportional relationships to solve multistep ratio and percent problems (Gr 7)" },
      { code:"NY-7.NS.1",   desc:"Apply and extend previous understandings of addition and subtraction to add and subtract rational numbers; represent addition and subtraction on a number line (Gr 7)" },
      { code:"NY-7.NS.2",   desc:"Apply and extend previous understandings of multiplication and division to multiply and divide rational numbers (Gr 7)" },
      { code:"NY-7.EE.3",   desc:"Solve multi-step real-life and mathematical problems posed with positive and negative rational numbers in any form (Gr 7)" },
      { code:"NY-7.EE.4",   desc:"Use variables to represent quantities in a real-world or mathematical problem; construct simple equations and inequalities to solve problems (Gr 7)" },
      { code:"NY-7.G.4",    desc:"Know and use the formulas for the area and circumference of a circle; solve problems involving area, circumference, and parts of circles (Gr 7)" },
      { code:"NY-7.G.6",    desc:"Solve real-world and mathematical problems involving area, volume, and surface area of two- and three-dimensional objects (Gr 7)" },
      { code:"NY-7.SP.1",   desc:"Understand that statistics can be used to gain information about a population by examining a sample; understand that random sampling produces representative samples (Gr 7)" },
      { code:"NY-8.NS.1",   desc:"Know that numbers that are not rational are called irrational; understand informally that every number has a decimal expansion (Gr 8)" },
      { code:"NY-8.EE.1",   desc:"Know and apply the properties of integer exponents to generate equivalent numerical expressions (Gr 8)" },
      { code:"NY-8.EE.5",   desc:"Graph proportional relationships interpreting the unit rate as the slope; compare two different proportional relationships represented in different ways (Gr 8)" },
      { code:"NY-8.EE.7",   desc:"Solve linear equations in one variable including equations with rational number coefficients; collect like terms and expand expressions using the distributive property (Gr 8)" },
      { code:"NY-8.EE.8",   desc:"Analyze and solve pairs of simultaneous linear equations graphically and algebraically; solve real-world problems leading to two linear equations in two variables (Gr 8)" },
      { code:"NY-8.F.1",    desc:"Understand that a function is a rule that assigns exactly one output to each input; the graph of a function is the set of ordered pairs (Gr 8)" },
      { code:"NY-8.F.4",    desc:"Construct a function to model a linear relationship; determine rate of change and initial value from a description, graph, table, or equation (Gr 8)" },
      { code:"NY-8.G.5",    desc:"Use informal arguments to establish facts about angle sum of triangles, exterior angles, angles created by parallel lines cut by a transversal, and angle-angle criterion (Gr 8)" },
      { code:"NY-8.G.7",    desc:"Apply the Pythagorean Theorem to determine unknown side lengths in right triangles in real-world and mathematical problems in two and three dimensions (Gr 8)" },
      { code:"NY-8.SP.1",   desc:"Construct and interpret scatter plots for bivariate measurement data to investigate patterns of association (Gr 8)" },
    ],
    // ── NYS Next Generation Mathematics Learning Standards (high school) ──
    // Codes follow the NYS Next Gen convention: AI = Algebra I, GEO = Geometry,
    // AII = Algebra II. Descriptions reflect the right-column "NYS Next Generation
    // Learning Standard" language from the official crosswalks.
    "Grades 9 – 12": [
      // Algebra I — Number & Quantity / Expressions / Equations / Functions / Stats
      { code:"AI-N.Q.1",     desc:"Use units as a way to understand problems and to guide the solution of multi-step problems; choose and interpret units consistently in formulas (Algebra I, NYS Next Gen)" },
      { code:"AI-N.Q.2",     desc:"Identify, interpret, and justify appropriate quantities for the purpose of descriptive modeling (Algebra I, NYS Next Gen)" },
      { code:"AI-A.SSE.1",   desc:"Interpret expressions that represent a quantity in terms of its context — interpret parts of an expression such as terms, factors, and coefficients (Algebra I, NYS Next Gen)" },
      { code:"AI-A.SSE.3",   desc:"Choose and produce an equivalent form of an expression to reveal and explain properties of the quantity represented (factor a quadratic, complete the square, use properties of exponents) (Algebra I, NYS Next Gen)" },
      { code:"AI-A.APR.1",   desc:"Add, subtract, and multiply polynomials and recognize that polynomials form a system analogous to the integers, closed under these operations (Algebra I, NYS Next Gen)" },
      { code:"AI-A.CED.1",   desc:"Create equations and inequalities in one variable to represent a real-world context (linear, quadratic, and exponential of the form f(x)=a·b^x where a>0 and b>0, b≠1) (Algebra I, NYS Next Gen)" },
      { code:"AI-A.CED.2",   desc:"Create equations and linear inequalities in two variables to represent a real-world context; graph on coordinate axes with labels and scales (Algebra I, NYS Next Gen)" },
      { code:"AI-A.REI.3",   desc:"Solve linear equations and inequalities in one variable, including equations with coefficients represented by letters (Algebra I, NYS Next Gen)" },
      { code:"AI-A.REI.4",   desc:"Solve quadratic equations in one variable by inspection, taking square roots, factoring, completing the square, and the quadratic formula, as appropriate to the initial form of the equation (Algebra I, NYS Next Gen)" },
      { code:"AI-A.REI.6",   desc:"Solve systems of linear equations in two variables both algebraically and graphically (Algebra I, NYS Next Gen)" },
      { code:"AI-F.IF.4",    desc:"For a function that models a relationship between two quantities, interpret key features of graphs and tables — intercepts, intervals of increase/decrease, maxima, minima, end behavior — and sketch graphs showing key features given a verbal description (Algebra I, NYS Next Gen)" },
      { code:"AI-F.IF.7",    desc:"Graph functions expressed symbolically and show key features of the graph, by hand and using technology (linear, quadratic, square root, cube root, piecewise, absolute value, step, exponential) (Algebra I, NYS Next Gen)" },
      { code:"AI-F.BF.3",    desc:"Using f(x)+k, kf(x), and f(x+k): identify the effect on the graph of replacing f(x) by these transformations for specific values of k (both positive and negative); find the value of k given the graphs (Algebra I, NYS Next Gen)" },
      { code:"AI-F.LE.2",    desc:"Construct a linear or exponential function symbolically given a graph, a description of a relationship, or two input-output pairs (including reading these from a table) (Algebra I, NYS Next Gen)" },
      { code:"AI-S.ID.6",    desc:"Represent bivariate data on a scatter plot, and describe how the variables' values are related; fit a function to the data; use the function to solve problems in context (Algebra I, NYS Next Gen)" },

      // Geometry
      { code:"GEO-G.CO.9",   desc:"Prove and apply theorems about lines and angles — vertical angles are congruent, alternate interior angles are congruent, points on a perpendicular bisector are equidistant from the segment's endpoints (Geometry, NYS Next Gen)" },
      { code:"GEO-G.CO.10",  desc:"Prove and apply theorems about triangles — sum of interior angles, base angles of isosceles triangles, the segment joining midpoints of two sides is parallel to the third side and half the length, medians meet at a point (Geometry, NYS Next Gen)" },
      { code:"GEO-G.CO.11",  desc:"Prove and apply theorems about parallelograms — opposite sides and angles are congruent, diagonals bisect each other, rectangles are parallelograms with congruent diagonals (Geometry, NYS Next Gen)" },
      { code:"GEO-G.SRT.5",  desc:"Use congruence and similarity criteria for triangles to solve problems and to justify relationships in geometric figures (Geometry, NYS Next Gen)" },
      { code:"GEO-G.SRT.8",  desc:"Use sine, cosine, tangent, the Pythagorean Theorem, and properties of special right triangles to solve right triangles in applied problems (Geometry, NYS Next Gen)" },
      { code:"GEO-G.C.2",    desc:"Identify, describe, and apply relationships between the angles and arcs of a circle and relationships among inscribed angles, radii, and chords (Geometry, NYS Next Gen)" },
      { code:"GEO-G.C.5",    desc:"Using similarity, derive the fact that the length of the arc intercepted by a central angle is proportional to the radius; derive and apply the formula for the area of a sector (Geometry, NYS Next Gen)" },
      { code:"GEO-G.GPE.4",  desc:"Use coordinates to prove simple geometric theorems algebraically (Geometry, NYS Next Gen)" },
      { code:"GEO-G.GPE.5",  desc:"Justify the slope criteria for parallel and perpendicular lines and use them to solve geometric problems (Geometry, NYS Next Gen)" },
      { code:"GEO-G.GMD.3",  desc:"Apply volume formulas for cylinders, pyramids, cones, and spheres to solve problems (Geometry, NYS Next Gen)" },
      { code:"GEO-G.MG.1",   desc:"Use geometric shapes, their measures, and their properties to describe objects (e.g., model a tree trunk or a human torso as a cylinder) (Geometry, NYS Next Gen)" },

      // Algebra II — Number, Algebra, Functions, Trig, Stats & Probability
      { code:"AII-N.RN.1",   desc:"Explore how the meaning of rational exponents follows from extending the properties of integer exponents (Algebra II, NYS Next Gen)" },
      { code:"AII-N.RN.2",   desc:"Convert between radical expressions and expressions with rational exponents using the properties of exponents (Algebra II, NYS Next Gen)" },
      { code:"AII-N.CN.1",   desc:"Know there is a complex number i such that i² = -1, and every complex number has the form a + bi with a and b real (Algebra II, NYS Next Gen)" },
      { code:"AII-N.CN.2",   desc:"Use the relation i² = -1 and the commutative, associative, and distributive properties to add, subtract, and multiply complex numbers, including simplifying powers of i (Algebra II, NYS Next Gen)" },
      { code:"AII-A.SSE.2",  desc:"Recognize and use the structure of an expression to identify ways to rewrite it, including factoring by grouping and factoring the sum and difference of cubes (Algebra II, NYS Next Gen)" },
      { code:"AII-A.SSE.4",  desc:"Derive the formula for the sum of a finite geometric series and use the formula to solve problems (Algebra II, NYS Next Gen)" },
      { code:"AII-A.APR.2",  desc:"Apply the Remainder Theorem: For a polynomial p(x) and a number a, p(a) is the remainder on division by (x-a); so p(a)=0 if and only if (x-a) is a factor of p(x) (Algebra II, NYS Next Gen)" },
      { code:"AII-A.APR.3",  desc:"Identify zeros of polynomial functions when suitable factorizations are available, and use the zeros to construct a rough graph of the function defined by the polynomial (Algebra II, NYS Next Gen)" },
      { code:"AII-A.APR.6",  desc:"Rewrite simple rational expressions in different forms; write a(x)/b(x) in the form q(x) + r(x)/b(x) using inspection, long division, or a computer algebra system (Algebra II, NYS Next Gen)" },
      { code:"AII-A.CED.1",  desc:"Create equations and inequalities in one variable to represent a real-world context (including rational, exponential, square root, cube root, and absolute value) (Algebra II, NYS Next Gen)" },
      { code:"AII-A.REI.2",  desc:"Solve rational and radical equations in one variable, identify extraneous solutions, and explain how they arise (Algebra II, NYS Next Gen)" },
      { code:"AII-A.REI.11", desc:"Given the equations y=f(x) and y=g(x), explain why the x-coordinates of the points of intersection are the solutions of f(x)=g(x); find the solutions approximately using technology to graph the functions or make tables of values (Algebra II, NYS Next Gen)" },
      { code:"AII-F.IF.4",   desc:"For a function that models a relationship between two quantities, interpret key features of graphs and tables and sketch graphs showing key features given a verbal description (square root, cube root, polynomial, exponential, logarithmic, sine, cosine, tangent) (Algebra II, NYS Next Gen)" },
      { code:"AII-F.IF.7",   desc:"Graph functions expressed symbolically and show key features of the graph, by hand and using technology — polynomial, square root, cube root, exponential, logarithmic, sine, cosine, and tangent functions (Algebra II, NYS Next Gen)" },
      { code:"AII-F.BF.1",   desc:"Write a function that describes a relationship between two quantities, including combining standard function types using arithmetic operations (Algebra II, NYS Next Gen)" },
      { code:"AII-F.BF.4a",  desc:"Find the inverse of a one-to-one function both algebraically and graphically (Algebra II, NYS Next Gen)" },
      { code:"AII-F.LE.4",   desc:"For exponential models, express as a logarithm the solution to a·b^(ct)=d where a, c, and d are real numbers and b is 2, 10, or e; evaluate the logarithm using technology (Algebra II, NYS Next Gen)" },
      { code:"AII-F.TF.2",   desc:"Apply concepts of the unit circle in the coordinate plane to calculate the values of the six trigonometric functions given angles in radian measure (Algebra II, NYS Next Gen)" },
      { code:"AII-F.TF.5",   desc:"Choose trigonometric functions to model periodic phenomena with specified amplitude, frequency, and midline (Algebra II, NYS Next Gen)" },
      { code:"AII-F.TF.8",   desc:"Prove the Pythagorean identity sin²(θ) + cos²(θ) = 1 and use it to find sin(θ), cos(θ), or tan(θ) given one of the values and the quadrant of the angle (Algebra II, NYS Next Gen)" },
      { code:"AII-S.ID.4",   desc:"Recognize whether or not a normal curve is appropriate for a given data set; if appropriate, use the mean and standard deviation to estimate population percentages using the empirical rule and/or technology (Algebra II, NYS Next Gen)" },
      { code:"AII-S.IC.1",   desc:"Understand statistics as a process for making inferences about population parameters based on a random sample from that population (Algebra II, NYS Next Gen)" },
      { code:"AII-S.IC.3",   desc:"Recognize the purposes of and differences among sample surveys, experiments, and observational studies; explain how randomization relates to each (Algebra II, NYS Next Gen)" },
      { code:"AII-S.IC.6",   desc:"Evaluate reports based on data (Algebra II, NYS Next Gen)" },
    ],
  },
  "Science": {
    "Pre-K – 2": [
      { code:"K-PS2-1",   desc:"Plan and conduct an investigation to compare the effects of different strengths or directions of pushes and pulls on the motion of an object (K)" },
      { code:"K-PS2-2",   desc:"Analyze data to determine if a design solution works as intended to change the speed or direction of an object with a push or a pull (K)" },
      { code:"K-PS3-1",   desc:"Make observations to determine the effect of sunlight on Earth's surface (K)" },
      { code:"K-LS1-1",   desc:"Use observations to describe patterns of what plants and animals (including humans) need to survive (K)" },
      { code:"K-ESS2-1",  desc:"Use and share observations of local weather conditions to describe patterns over time (K)" },
      { code:"K-ESS3-1",  desc:"Use a model to represent the relationship between the needs of different plants and animals and the places they live (K)" },
      { code:"1-PS4-1",   desc:"Plan and conduct investigations to provide evidence that vibrating materials can make sound and that sound can make materials vibrate (Gr 1)" },
      { code:"1-PS4-2",   desc:"Make observations to construct an evidence-based account that objects can be seen only when illuminated (Gr 1)" },
      { code:"1-LS1-1",   desc:"Use materials to design a solution to a human problem by mimicking how plants and/or animals use their external parts to help them survive (Gr 1)" },
      { code:"1-LS3-1",   desc:"Make observations to construct an evidence-based account that young plants and animals are like, but not exactly like, their parents (Gr 1)" },
      { code:"1-ESS1-1",  desc:"Use observations of the sun, moon, and stars to describe patterns that can be predicted (Gr 1)" },
      { code:"2-PS1-1",   desc:"Plan and conduct an investigation to describe and classify different kinds of materials by their observable properties (Gr 2)" },
      { code:"2-PS1-3",   desc:"Make observations to construct an evidence-based account of how an object made of a small set of pieces can be disassembled and made into a new object (Gr 2)" },
      { code:"2-LS2-1",   desc:"Plan and conduct an investigation to determine if plants need sunlight and water to grow (Gr 2)" },
      { code:"2-LS4-1",   desc:"Make observations of plants and animals to compare the diversity of life in different habitats (Gr 2)" },
      { code:"2-ESS1-1",  desc:"Use information from several sources to provide evidence that Earth events can occur quickly or slowly (Gr 2)" },
      { code:"2-ESS2-1",  desc:"Compare multiple solutions designed to slow or prevent wind or water from changing the shape of the land (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"3-PS2-1",   desc:"Plan and conduct an investigation to provide evidence of the effects of balanced and unbalanced forces on the motion of an object (Gr 3)" },
      { code:"3-PS2-3",   desc:"Ask questions to determine cause-and-effect relationships of electric or magnetic interactions between two objects not in contact (Gr 3)" },
      { code:"3-LS1-1",   desc:"Develop models to describe that organisms have unique and diverse life cycles but all have in common birth, growth, reproduction, and death (Gr 3)" },
      { code:"3-LS3-2",   desc:"Use evidence to support the explanation that traits can be influenced by the environment (Gr 3)" },
      { code:"3-LS4-3",   desc:"Construct an argument with evidence that in a particular habitat some organisms can survive well, some less well, and some cannot survive at all (Gr 3)" },
      { code:"3-ESS2-1",  desc:"Represent data in tables and graphical displays to describe typical weather conditions expected during a particular season (Gr 3)" },
      { code:"3-ESS3-1",  desc:"Make a claim about the merit of a design solution that reduces the impacts of a weather-related hazard (Gr 3)" },
      { code:"4-PS3-1",   desc:"Use evidence to construct an explanation relating the speed of an object to the energy of that object (Gr 4)" },
      { code:"4-PS3-2",   desc:"Make observations to provide evidence that energy can be transferred from place to place by sound, light, heat, and electric currents (Gr 4)" },
      { code:"4-LS1-1",   desc:"Construct an argument that plants and animals have internal and external structures that function to support survival, growth, behavior, and reproduction (Gr 4)" },
      { code:"4-LS1-2",   desc:"Use a model to describe that animals receive different types of information through their senses, process the information, and respond in different ways (Gr 4)" },
      { code:"4-ESS1-1",  desc:"Identify evidence from patterns in rock formations and fossils in rock layers to support an explanation for changes in a landscape over time (Gr 4)" },
      { code:"4-ESS2-1",  desc:"Make observations and/or measurements to provide evidence of the effects of weathering or the rate of erosion by water, ice, wind, or vegetation (Gr 4)" },
      { code:"4-ESS3-2",  desc:"Generate and compare multiple solutions to reduce the impacts of natural Earth processes on humans (Gr 4)" },
      { code:"5-PS1-1",   desc:"Develop a model to describe that matter is made of particles too small to be seen (Gr 5)" },
      { code:"5-PS1-3",   desc:"Make observations and measurements to identify materials based on their properties (Gr 5)" },
      { code:"5-PS3-1",   desc:"Use models to describe that energy in animals' food was once energy from the sun (Gr 5)" },
      { code:"5-LS1-1",   desc:"Support an argument that plants get the materials they need for growth chiefly from air and water (Gr 5)" },
      { code:"5-LS2-1",   desc:"Develop a model to describe the movement of matter among plants, animals, decomposers, and the environment (Gr 5)" },
      { code:"5-ESS1-2",  desc:"Represent data in graphical displays to reveal patterns of daily changes in length and direction of shadows, day and night, and seasonal positions (Gr 5)" },
      { code:"5-ESS2-1",  desc:"Develop a model using an example to describe ways the geosphere, biosphere, hydrosphere, and/or atmosphere interact (Gr 5)" },
      { code:"5-ESS3-1",  desc:"Obtain and combine information about ways individual communities use science ideas to protect Earth's resources and environment (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"MS-PS1-2",  desc:"Analyze and interpret data on the properties of substances before and after the substances interact to determine if a chemical reaction has occurred (Gr 6–8)" },
      { code:"MS-PS1-4",  desc:"Develop a model that predicts and describes changes in particle motion, temperature, and state of a pure substance when energy is added or removed (Gr 6–8)" },
      { code:"MS-PS2-2",  desc:"Plan an investigation to provide evidence that the change in an object's motion depends on the sum of the forces on the object and the mass of the object (Gr 6–8)" },
      { code:"MS-PS3-1",  desc:"Construct and interpret graphical displays of data to describe the relationships of kinetic energy to the mass of an object and to the speed of an object (Gr 6–8)" },
      { code:"MS-PS4-2",  desc:"Develop and use a model to describe that waves are reflected, absorbed, or transmitted through various materials (Gr 6–8)" },
      { code:"MS-LS1-3",  desc:"Use argument supported by evidence for how the body is a system of interacting subsystems composed of groups of cells (Gr 6–8)" },
      { code:"MS-LS1-6",  desc:"Construct a scientific explanation based on evidence for the role of photosynthesis in the cycling of matter and flow of energy into and out of organisms (Gr 6–8)" },
      { code:"MS-LS2-1",  desc:"Analyze and interpret data to provide evidence for the effects of resource availability on organisms and populations of organisms in an ecosystem (Gr 6–8)" },
      { code:"MS-LS3-1",  desc:"Develop and use a model to describe why structural changes to genes (mutations) located on chromosomes may affect proteins and may result in harmful, beneficial, or neutral effects (Gr 6–8)" },
      { code:"MS-LS4-2",  desc:"Apply scientific ideas to construct an explanation for the anatomical similarities and differences among modern organisms and between modern and fossil organisms (Gr 6–8)" },
      { code:"MS-ESS1-1", desc:"Develop and use a model of the Earth-sun-moon system to describe the cyclic patterns of lunar phases, eclipses, and seasons (Gr 6–8)" },
      { code:"MS-ESS2-1", desc:"Develop a model to describe the cycling of Earth's materials and the flow of energy that drives this process (Gr 6–8)" },
      { code:"MS-ESS2-4", desc:"Develop a model to describe the cycling of water through Earth's systems driven by energy from the sun and the force of gravity (Gr 6–8)" },
      { code:"MS-ESS3-3", desc:"Apply scientific principles to design a method for monitoring and minimizing a human impact on the environment (Gr 6–8)" },
      { code:"MS-ESS3-5", desc:"Ask questions to clarify evidence of the factors that have caused the rise in global temperatures over the past century (Gr 6–8)" },
      { code:"MS-ETS1-1", desc:"Define the criteria and constraints of a design problem with sufficient precision to ensure a successful solution (Gr 6–8)" },
      { code:"MS-ETS1-3", desc:"Analyze data from tests to determine similarities and differences among several design solutions to identify the best characteristics of each (Gr 6–8)" },
    ],
    "Grades 9 – 12": [
      { code:"HS-PS1-1",  desc:"Use the periodic table as a model to predict the relative properties of elements based on the patterns of electrons in the outermost energy level of atoms (Gr 9–12)" },
      { code:"HS-PS1-2",  desc:"Construct and revise an explanation for the outcome of a simple chemical reaction based on the outermost electron states of atoms, trends in the periodic table, and patterns of bonding (Gr 9–12)" },
      { code:"HS-PS2-1",  desc:"Analyze data to support the claim that Newton's second law of motion describes the mathematical relationship among net force, mass, and acceleration (Gr 9–12)" },
      { code:"HS-PS3-1",  desc:"Create a computational model to calculate the change in energy of one component in a system when the change in energy of the other component(s) and energy flows in/out are known (Gr 9–12)" },
      { code:"HS-PS4-1",  desc:"Use mathematical representations to support a claim regarding relationships among the frequency, wavelength, and speed of waves traveling in various media (Gr 9–12)" },
      { code:"HS-LS1-1",  desc:"Construct an explanation based on evidence for how the structure of DNA determines the structure of proteins which carry out the essential functions of life (Gr 9–12)" },
      { code:"HS-LS1-5",  desc:"Use a model to illustrate how photosynthesis transforms light energy into stored chemical energy (Gr 9–12)" },
      { code:"HS-LS2-2",  desc:"Use mathematical representations to support and revise explanations based on evidence about factors affecting biodiversity and populations in ecosystems of different scales (Gr 9–12)" },
      { code:"HS-LS3-1",  desc:"Ask questions to clarify relationships about the role of DNA and chromosomes in coding the instructions for characteristic traits passed from parents to offspring (Gr 9–12)" },
      { code:"HS-LS4-2",  desc:"Construct an explanation based on evidence that the process of evolution primarily results from genetic variation, competition, reproduction, and survival (Gr 9–12)" },
      { code:"HS-ESS1-1", desc:"Develop a model based on evidence to illustrate the life span of the sun and the role of nuclear fusion in the sun's core to release energy (Gr 9–12)" },
      { code:"HS-ESS2-2", desc:"Analyze geoscience data to make the claim that one change to Earth's surface can create feedbacks that cause changes to other Earth systems (Gr 9–12)" },
      { code:"HS-ESS2-5", desc:"Plan and conduct an investigation of the properties of water and its effects on Earth materials and surface processes (Gr 9–12)" },
      { code:"HS-ESS3-1", desc:"Construct an explanation based on evidence for how the availability of natural resources, occurrence of natural hazards, and changes in climate have influenced human activity (Gr 9–12)" },
      { code:"HS-ESS3-5", desc:"Analyze geoscience data and the results from global climate models to make an evidence-based forecast of current rate of global or regional climate change (Gr 9–12)" },
      { code:"HS-ETS1-1", desc:"Analyze a major global challenge to specify qualitative and quantitative criteria and constraints for solutions that account for societal needs and wants (Gr 9–12)" },
      { code:"HS-ETS1-3", desc:"Evaluate a solution to a complex real-world problem based on prioritized criteria and trade-offs that account for a range of constraints (Gr 9–12)" },
    ],
  },
  "Social Studies": {
    "Pre-K – 2": [
      { code:"PK.1",  desc:"Self & Others — Children develop understanding of self, family, classroom community, and basic roles and responsibilities (Pre-K)" },
      { code:"PK.2",  desc:"Children explore similarities/differences among individuals and families (Pre-K)" },
      { code:"K.1",   desc:"Self & Others — Each person is unique and important; people share common needs (K)" },
      { code:"K.2",   desc:"Citizens follow rules and have rights and responsibilities at home, school, and in the community (K)" },
      { code:"K.4",   desc:"Maps and globes are tools used to show places (K)" },
      { code:"K.6",   desc:"People work to earn money to meet their needs and wants (K)" },
      { code:"1.1",   desc:"My Family & Other Families, Now & Long Ago — Family structures, traditions, and how families change over time (Gr 1)" },
      { code:"1.2",   desc:"Roles, rights, and responsibilities of family and community members (Gr 1)" },
      { code:"1.4",   desc:"Maps and globes show locations of families and communities; geographic features influence how people live (Gr 1)" },
      { code:"1.6",   desc:"Goods and services; producers and consumers; spending and saving (Gr 1)" },
      { code:"2.1",   desc:"My Community & Other U.S. Communities — Communities are made up of people from many cultures with diverse traditions (Gr 2)" },
      { code:"2.2",   desc:"Communities have rules, leaders, and ways of making decisions democratically (Gr 2)" },
      { code:"2.4",   desc:"Geography of communities — physical features, location, and how people adapt to/modify their environment (Gr 2)" },
      { code:"2.6",   desc:"Communities depend on the production, distribution, and consumption of goods and services (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"3.1",  desc:"Communities Around the World — Geography, climate, and natural resources shape ways of life (Gr 3)" },
      { code:"3.4",  desc:"Communities share traditions, beliefs, customs, and celebrations around the world (Gr 3)" },
      { code:"3.7",  desc:"Communities face challenges and find solutions over time (Gr 3)" },
      { code:"4.1",  desc:"Geography of New York State — physical features and regions (Gr 4)" },
      { code:"4.2",  desc:"Native American groups indigenous to NYS, including the Haudenosaunee (Gr 4)" },
      { code:"4.3",  desc:"Colonial and Revolutionary New York: settlement, daily life, and causes/effects of the American Revolution (Gr 4)" },
      { code:"4.4",  desc:"Government, immigration, industry, and reform in NYS history (Gr 4)" },
      { code:"4.5",  desc:"NYS today — government, economy, and diverse population (Gr 4)" },
      { code:"5.1",  desc:"Western Hemisphere — geography of North, Central, and South America and the Caribbean (Gr 5)" },
      { code:"5.2",  desc:"Indigenous peoples of the Western Hemisphere prior to European contact (Gr 5)" },
      { code:"5.3",  desc:"European exploration, colonization, and the slave trade in the Western Hemisphere (Gr 5)" },
      { code:"5.6",  desc:"Independence movements and nation-building in the Western Hemisphere (Gr 5)" },
      { code:"5.8",  desc:"Government and citizenship in the Western Hemisphere; comparing democratic and other systems (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"6.1",  desc:"World Geography — physical and human geography of the Eastern Hemisphere (Gr 6)" },
      { code:"6.2",  desc:"Earliest human communities — hunter-gatherers, agricultural revolution, river civilizations (Gr 6)" },
      { code:"6.4",  desc:"Classical civilizations — Greece, Rome, China, India — and their lasting influence (Gr 6)" },
      { code:"6.7",  desc:"Interactions across the Eastern Hemisphere — trade, religion, conflict, and cultural exchange (Gr 6)" },
      { code:"7.1",  desc:"Native Americans — diverse societies in North America before European contact (Gr 7)" },
      { code:"7.2",  desc:"European exploration and colonization of the Americas (Gr 7)" },
      { code:"7.3",  desc:"Slavery, the Atlantic World, and colonial society (Gr 7)" },
      { code:"7.4",  desc:"Causes of the American Revolution and creation of a new government (Gr 7)" },
      { code:"7.5",  desc:"The Constitution and the Bill of Rights (Gr 7)" },
      { code:"7.7",  desc:"Reform movements (abolition, women's rights, education, temperance) in the antebellum era (Gr 7)" },
      { code:"7.8",  desc:"A Nation Divided — causes, course, and consequences of the Civil War and Reconstruction (Gr 7)" },
      { code:"8.1",  desc:"Industrialization and urbanization in late 19th-century America (Gr 8)" },
      { code:"8.2",  desc:"Immigration and migration to the United States (Gr 8)" },
      { code:"8.3",  desc:"Progressive Era reforms (Gr 8)" },
      { code:"8.4",  desc:"U.S. expansion, imperialism, and World War I (Gr 8)" },
      { code:"8.5",  desc:"The Roaring Twenties, Great Depression, and New Deal (Gr 8)" },
      { code:"8.6",  desc:"World War II and the U.S. as a global power (Gr 8)" },
      { code:"8.8",  desc:"The Civil Rights movement and continuing struggles for equality (Gr 8)" },
      { code:"8.10", desc:"Contemporary U.S. — globalization, technology, and current issues (Gr 8)" },
    ],
    "Grades 9 – 12": [
      { code:"9.1",   desc:"Development of Civilization — geography, early civilizations, and classical traditions (Global I)" },
      { code:"9.4",   desc:"Rise of transregional trade networks and cultural diffusion (Global I)" },
      { code:"9.7",   desc:"Ottoman, Ming/Qing, Mughal, and other early modern empires (Global I)" },
      { code:"9.9",   desc:"Transformation of Western Europe and Russia — Renaissance, Reformation, Scientific Revolution (Global I)" },
      { code:"10.1",  desc:"The World in 1750 — political, economic, and social structures (Global II)" },
      { code:"10.2",  desc:"Enlightenment, Revolution, and Nationalism (Global II)" },
      { code:"10.3",  desc:"Causes and effects of the Industrial Revolution (Global II)" },
      { code:"10.4",  desc:"Imperialism — its causes, methods, and consequences (Global II)" },
      { code:"10.5",  desc:"World Wars I and II and the interwar period (Global II)" },
      { code:"10.7",  desc:"Decolonization and the Cold War (Global II)" },
      { code:"10.10", desc:"Globalization and contemporary issues (Global II)" },
      { code:"11.1",  desc:"Colonial Foundations — geography, settlement, and colonial society (US History)" },
      { code:"11.2",  desc:"Constitutional Foundations — Revolution, Constitution, and early Republic (US History)" },
      { code:"11.3",  desc:"Expansion, Nationalism, and Sectionalism (US History)" },
      { code:"11.4",  desc:"Civil War and Reconstruction (US History)" },
      { code:"11.5",  desc:"Industrialization and the Gilded Age (US History)" },
      { code:"11.6",  desc:"The Rise of American Power — imperialism and World War I (US History)" },
      { code:"11.7",  desc:"Prosperity and Depression — 1920s, Great Depression, New Deal (US History)" },
      { code:"11.8",  desc:"World War II and post-war America (US History)" },
      { code:"11.9",  desc:"The Cold War — origins, conflicts, and end (US History)" },
      { code:"11.10", desc:"Domestic change — Civil Rights and social movements (US History)" },
      { code:"11.11", desc:"Contemporary U.S. and the changing world (US History)" },
      { code:"12.G1", desc:"Foundations of American Democracy — natural rights, social contract, and constitutional principles (Participation in Government)" },
      { code:"12.G2", desc:"Civil Rights and Civil Liberties (Participation in Government)" },
      { code:"12.G4", desc:"Public Policy — issues, processes, and citizen participation (Participation in Government)" },
      { code:"12.E1", desc:"Economic systems, factors of production, and the role of markets (Economics)" },
      { code:"12.E2", desc:"The U.S. economy — supply, demand, prices, and competition (Economics)" },
      { code:"12.E5", desc:"Personal finance — budgeting, saving, credit, investing, and consumer protection (Economics)" },
    ],
  },
  // ── NYS Learning Standards for World Languages (2021) ─────────────────
  // Five anchor standards (Communication 1–3, Cultures 4–5) applied across
  // proficiency levels (Novice → Intermediate → Advanced).
  "World Languages": {
    "Pre-K – 2": [
      { code:"WL.1.NL", desc:"Interpretive Communication (Novice Low) — Recognize a few familiar words and phrases in the target language when heard, read, or viewed in highly predictable contexts" },
      { code:"WL.2.NL", desc:"Interpersonal Communication (Novice Low) — Communicate with others using single words and memorized phrases on very familiar topics, supported by gestures and visuals" },
      { code:"WL.3.NL", desc:"Presentational Communication (Novice Low) — Present information about self and very familiar topics using words, phrases, and memorized expressions" },
      { code:"WL.4.NL", desc:"Cultural Practices & Products (Novice Low) — Identify, with prompts, a few cultural practices and products of the target culture (e.g., greetings, foods, songs, holidays)" },
      { code:"WL.5.NL", desc:"Cultural Comparisons (Novice Low) — Identify obvious similarities and differences between the target culture(s) and one's own" },
    ],
    "Grades 3 – 5": [
      { code:"WL.1.NM", desc:"Interpretive Communication (Novice Mid) — Identify familiar words, phrases, and simple sentences in spoken, written, or signed texts on familiar topics" },
      { code:"WL.2.NM", desc:"Interpersonal Communication (Novice Mid) — Exchange information using memorized words, phrases, and simple questions/answers on highly familiar topics (self, family, school)" },
      { code:"WL.3.NM", desc:"Presentational Communication (Novice Mid) — Present information on familiar topics using a series of simple sentences with visual or written support" },
      { code:"WL.4.NM", desc:"Cultural Practices & Products (Novice Mid) — Describe, in the target language, common practices and products of the cultures studied (e.g., daily routines, traditional foods, celebrations)" },
      { code:"WL.5.NM", desc:"Cultural Comparisons (Novice Mid) — Use the target language to describe similarities and differences between products and practices of the studied culture(s) and one's own" },
    ],
    "Grades 6 – 8": [
      { code:"WL.1.NH", desc:"Interpretive Communication (Novice High) — Understand the main idea and some details of short, simple texts on everyday topics presented through familiar language" },
      { code:"WL.2.NH", desc:"Interpersonal Communication (Novice High) — Participate in short conversations and written/signed exchanges on familiar topics; ask and answer simple questions, exchange opinions and preferences" },
      { code:"WL.3.NH", desc:"Presentational Communication (Novice High) — Present information, narrate events, and describe people/places/things using connected sentences on familiar topics" },
      { code:"WL.1.IL", desc:"Interpretive Communication (Intermediate Low) — Understand the main idea and some details in authentic texts on familiar topics, including some unfamiliar vocabulary inferred from context" },
      { code:"WL.2.IL", desc:"Interpersonal Communication (Intermediate Low) — Initiate, sustain, and close conversations on a variety of familiar topics; handle simple transactions and unexpected complications" },
      { code:"WL.3.IL", desc:"Presentational Communication (Intermediate Low) — Present information, narrate, describe, and express opinions on a variety of familiar topics using connected sentences and paragraphs" },
      { code:"WL.4.IL", desc:"Cultural Practices & Products (Intermediate Low) — Use the target language to describe and explain practices, products, and perspectives of the cultures studied" },
      { code:"WL.5.IL", desc:"Cultural Comparisons (Intermediate Low) — Compare and contrast products, practices, and perspectives of target cultures and one's own using the target language" },
    ],
    "Grades 9 – 12": [
      { code:"WL.1.IM",  desc:"Interpretive Communication (Intermediate Mid) — Understand main ideas and supporting details in a variety of authentic texts on familiar and some unfamiliar topics" },
      { code:"WL.2.IM",  desc:"Interpersonal Communication (Intermediate Mid) — Participate in conversations on a wide variety of familiar topics; exchange information, opinions, and preferences with increasing fluency and accuracy" },
      { code:"WL.3.IM",  desc:"Presentational Communication (Intermediate Mid) — Present information, narrate, describe, and express opinions on a range of familiar topics using paragraph-level discourse" },
      { code:"WL.1.IH",  desc:"Interpretive Communication (Intermediate High) — Understand main ideas and most supporting details across a variety of authentic texts on familiar and unfamiliar topics" },
      { code:"WL.2.IH",  desc:"Interpersonal Communication (Intermediate High) — Engage in conversations and discussions on familiar and some unfamiliar concrete topics; handle complications and express viewpoints with reasons" },
      { code:"WL.3.IH",  desc:"Presentational Communication (Intermediate High) — Deliver organized presentations and write/sign cohesive paragraphs on familiar and some unfamiliar topics, using a variety of time frames" },
      { code:"WL.1.AL",  desc:"Interpretive Communication (Advanced Low) — Understand the main ideas and most supporting details of authentic texts dealing with a variety of social, academic, and professional topics" },
      { code:"WL.2.AL",  desc:"Interpersonal Communication (Advanced Low) — Engage in extended conversations on a variety of topics; narrate and describe in major time frames and handle a complicated situation" },
      { code:"WL.3.AL",  desc:"Presentational Communication (Advanced Low) — Deliver detailed oral/signed and written presentations on concrete and some abstract topics with structure and coherence across time frames" },
      { code:"WL.4.AL",  desc:"Cultural Practices & Products (Advanced Low) — Use the target language to analyze how practices and products reflect cultural perspectives across communities studied" },
      { code:"WL.5.AL",  desc:"Cultural Comparisons (Advanced Low) — Use the target language to analyze and compare cultural perspectives, products, and practices of target cultures and one's own" },
      { code:"WL.CL.1",  desc:"Classical Languages — Interpretive: understand, interpret, and analyze authentic Classical (e.g., Latin, ancient Greek, ancient Hebrew) texts" },
      { code:"WL.CL.2",  desc:"Classical Languages — Presentational: present information and ideas grounded in Classical texts to inform, narrate, explain, and persuade" },
      { code:"WL.CL.4",  desc:"Classical Languages — Use knowledge of Classical languages to identify, describe, and explain practices, products, and perspectives of ancient cultures" },
    ],
  },
  "Health & PE": {
    "Pre-K – 2": [
      { code:"NYSHPE.PK.M.1",     desc:"Demonstrate basic locomotor patterns: walking, running, hopping, jumping, galloping (Pre-K)" },
      { code:"NYSHPE.K.H.1",      desc:"Identify basic personal health and hygiene practices and why they are important (K)" },
      { code:"NYSHPE.2.H.2",      desc:"Identify physical, social, and emotional components of health and well-being (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"NYSHPE.3-5.H.2",    desc:"Describe the components of health-related fitness: cardiorespiratory, muscular strength, flexibility (Gr 3–5)" },
      { code:"NYSHPE.5.H.4",      desc:"Identify the importance of regular physical activity and balanced nutrition for good health (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"NYSHPE.6-8.H.2",    desc:"Analyze how personal choices and behaviors affect physical, mental, and social health (Gr 6–8)" },
      { code:"NYSHPE.8.H.5",      desc:"Explain the importance of nutrition, activity, and sleep in preventing chronic disease (Gr 8)" },
    ],
    "Grades 9 – 12": [
      { code:"NYSHPE.9-12.H.1",   desc:"Develop, implement, and evaluate a personal fitness plan using principles of training (Gr 9–12)" },
      { code:"NYSHPE.9-12.H.2",   desc:"Analyze the relationship between healthy behaviors and long-term personal health outcomes (Gr 9–12)" },
    ],
  },
  "Arts": {
    "Pre-K – 2": [
      { code:"NYSARTS.VA-K.Cr1",  desc:"Explore and experience art materials with imagination and playful investigation (K)" },
      { code:"NYSARTS.VA-1.Re7",  desc:"Select and describe works of art that illustrate daily life experiences of one's self or others (Gr 1)" },
      { code:"NYSARTS.MU-K.Cr1",  desc:"With guidance, explore and experience music concepts such as beat and melodic contour (K)" },
    ],
    "Grades 3 – 5": [
      { code:"NYSARTS.VA-3.Cr2",  desc:"Create personally satisfying artwork using a variety of artistic processes and materials (Gr 3–5)" },
      { code:"NYSARTS.VA-4.Re9",  desc:"Apply criteria to evaluate more than one work of art using personal artistic criteria (Gr 4)" },
    ],
    "Grades 6 – 8": [
      { code:"NYSARTS.VA-6.Cn11", desc:"Describe how knowledge of culture, traditions, and history influences responses to art (Gr 6–8)" },
      { code:"NYSARTS.TH-7.Pr5",  desc:"Rehearse and present a drama/theatre work using theatrical staging and blocking (Gr 7)" },
    ],
    "Grades 9 – 12": [
      { code:"NYSARTS.VA-HS.Cr3", desc:"Reflect, re-engage, revise, and refine works of art considering personal artistic vision (Gr 9–12)" },
      { code:"NYSARTS.MU-HS.Pr6", desc:"Demonstrate technical accuracy and expressive qualities in prepared and improvised performances (Gr 9–12)" },
    ],
  },
  "Technology/CS": {
    "Pre-K – 2": [
      { code:"NYSCS.K-2.CT.1",    desc:"Identify and describe a problem that can be solved using a sequence of steps (K–2)" },
      { code:"NYSCS.K-2.DL.1",    desc:"Identify and use basic functions of a digital device safely and responsibly (K–2)" },
    ],
    "Grades 3 – 5": [
      { code:"NYSCS.3-5.CT.4",    desc:"Decompose a problem into smaller components and create an algorithm to solve it (Gr 3–5)" },
      { code:"NYSCS.3-5.CY.1",    desc:"Recognize that personal information is collected and used, and understand privacy settings (Gr 3–5)" },
    ],
    "Grades 6 – 8": [
      { code:"NYSCS.6-8.CT.5",    desc:"Create clearly named variables representing different data types and perform operations on their values (Gr 6–8)" },
      { code:"NYSCS.6-8.IC.1",    desc:"Describe the impact of computing and the internet on personal, community, and global decisions (Gr 6–8)" },
    ],
    "Grades 9 – 12": [
      { code:"NYSCS.9-12.CT.7",   desc:"Design and iteratively develop programs that combine control structures and use abstraction (Gr 9–12)" },
      { code:"NYSCS.9-12.IC.5",   desc:"Evaluate the beneficial and harmful effects of computing innovations on society (Gr 9–12)" },
    ],
  },
  // ── NYS Arts Standards (2017) — Visual Arts ───────────────────────────
  "Visual Arts": {
    "Pre-K – 2": [
      { code:"VA:Cr1.1.PK", desc:"Engage in self-directed play with materials (Pre-K)" },
      { code:"VA:Cr1.2.PK", desc:"Engage in self-directed, creative artmaking (Pre-K)" },
      { code:"VA:Cr1.1.K",  desc:"Engage in exploration and imaginative play with materials (K)" },
      { code:"VA:Cr1.2.K",  desc:"Engage collaboratively in creative artmaking in response to an artistic problem (K)" },
      { code:"VA:Cr2.1.K",  desc:"Through experimentation, build skills in various media and approaches to artmaking (K)" },
      { code:"VA:Cr2.2.K",  desc:"Identify safe and non-toxic art materials, tools, and equipment (K)" },
      { code:"VA:Pr4.1.K",  desc:"Select art objects for personal portfolio and display, explaining why they were chosen (K)" },
      { code:"VA:Pr5.1.K",  desc:"Explain the purpose of a portfolio or collection (K)" },
      { code:"VA:Re7.1.K",  desc:"Identify uses of art within one's personal environment (K)" },
      { code:"VA:Re8.1.K",  desc:"Interpret art by identifying subject matter and describing relevant details (K)" },
      { code:"VA:Cn10.1.K", desc:"Create art that tells a story about a life experience (K)" },
      { code:"VA:Cr1.1.1",  desc:"Engage collaboratively in exploration and imaginative play with materials (Gr 1)" },
      { code:"VA:Cr2.1.1",  desc:"Explore uses of materials and tools to create works of art or design (Gr 1)" },
      { code:"VA:Pr6.1.1",  desc:"Identify the roles and responsibilities of people who work in/visit museums and other art venues (Gr 1)" },
      { code:"VA:Re7.2.1",  desc:"Compare images that represent the same subject (Gr 1)" },
      { code:"VA:Cn11.1.1", desc:"Understand that people from different places and times have made art for a variety of reasons (Gr 1)" },
      { code:"VA:Cr1.1.2",  desc:"Brainstorm collaboratively multiple approaches to an art or design problem (Gr 2)" },
      { code:"VA:Cr3.1.2",  desc:"Discuss and reflect with peers about choices made in creating artwork (Gr 2)" },
      { code:"VA:Re9.1.2",  desc:"Use learned art vocabulary to express preferences about artwork (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"VA:Cr1.1.3",  desc:"Elaborate on an imaginative idea (Gr 3)" },
      { code:"VA:Cr2.1.3",  desc:"Create personally satisfying artwork using a variety of artistic processes and materials (Gr 3)" },
      { code:"VA:Cr3.1.3",  desc:"Elaborate visual information by adding details in an artwork to enhance emerging meaning (Gr 3)" },
      { code:"VA:Pr4.1.3",  desc:"Investigate and discuss possibilities and limitations of spaces for exhibiting artwork (Gr 3)" },
      { code:"VA:Re7.1.3",  desc:"Speculate about processes an artist uses to create a work of art (Gr 3)" },
      { code:"VA:Re8.1.3",  desc:"Interpret art by analyzing use of media to create subject matter and mood (Gr 3)" },
      { code:"VA:Cn10.1.3", desc:"Develop a work of art based on observations of surroundings (Gr 3)" },
      { code:"VA:Cr1.2.4",  desc:"Collaboratively set goals and create artwork that is meaningful and has purpose to the makers (Gr 4)" },
      { code:"VA:Cr2.1.4",  desc:"Explore and invent art-making techniques and approaches (Gr 4)" },
      { code:"VA:Re9.1.4",  desc:"Apply one set of criteria to evaluate more than one work of art (Gr 4)" },
      { code:"VA:Cn11.1.4", desc:"Through observation, infer information about time, place, and culture in which a work of art was created (Gr 4)" },
      { code:"VA:Cr1.1.5",  desc:"Combine ideas to generate an innovative idea for art-making (Gr 5)" },
      { code:"VA:Cr2.2.5",  desc:"Demonstrate quality craftsmanship through care for and use of materials, tools, and equipment (Gr 5)" },
      { code:"VA:Pr5.1.5",  desc:"Develop a logical argument for safe and effective use of materials and techniques for preparing and presenting artwork (Gr 5)" },
      { code:"VA:Re7.2.5",  desc:"Identify and analyze cultural associations suggested by visual imagery (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"VA:Cr1.1.6",  desc:"Combine concepts collaboratively to generate innovative ideas for creating art (Gr 6)" },
      { code:"VA:Cr1.2.6",  desc:"Use brainstorming to formulate an artistic investigation of personally relevant content (Gr 6)" },
      { code:"VA:Cr2.1.6",  desc:"Demonstrate openness in trying new ideas, materials, methods, and approaches (Gr 6)" },
      { code:"VA:Cr3.1.6",  desc:"Reflect on whether personal artwork conveys the intended meaning and revise accordingly (Gr 6)" },
      { code:"VA:Pr4.1.6",  desc:"Analyze similarities and differences associated with preserving and presenting two-/three-dimensional artwork (Gr 6)" },
      { code:"VA:Re7.1.6",  desc:"Identify and interpret works of art that reveal how people live around the world and what they value (Gr 6)" },
      { code:"VA:Re8.1.6",  desc:"Interpret art by distinguishing between relevant and non-relevant contextual information (Gr 6)" },
      { code:"VA:Cn10.1.6", desc:"Generate a collection of ideas reflecting current interests and concerns that could be investigated by art-making (Gr 6)" },
      { code:"VA:Cr2.3.7",  desc:"Apply visual organizational strategies to design and produce a work of art that clearly communicates information or ideas (Gr 7)" },
      { code:"VA:Pr6.1.7",  desc:"Compare and contrast viewing and experiencing collections and exhibitions in different venues (Gr 7)" },
      { code:"VA:Re9.1.7",  desc:"Compare and explain the difference between an evaluation of an artwork based on personal criteria and established criteria (Gr 7)" },
      { code:"VA:Cr1.1.8",  desc:"Document early stages of the creative process visually and/or verbally in traditional or new media (Gr 8)" },
      { code:"VA:Cr2.1.8",  desc:"Demonstrate willingness to experiment, innovate, and take risks to pursue ideas, forms, and meanings that emerge in the process of art-making (Gr 8)" },
      { code:"VA:Cn11.1.8", desc:"Distinguish different ways art is used to represent, establish, reinforce, and reflect group identity (Gr 8)" },
    ],
    "Grades 9 – 12": [
      { code:"VA:Cr1.1.HSI",   desc:"Use multiple approaches to begin creative endeavors (HS Proficient)" },
      { code:"VA:Cr2.1.HSI",   desc:"Engage in making a work of art using methods to overcome creative blocks (HS Proficient)" },
      { code:"VA:Cr3.1.HSI",   desc:"Apply relevant criteria from traditional and contemporary cultural contexts to examine, reflect on, and plan revisions for a work of art in progress (HS Proficient)" },
      { code:"VA:Pr5.1.HSI",   desc:"Analyze and evaluate the reasons and ways an exhibition is presented (HS Proficient)" },
      { code:"VA:Re7.1.HSI",   desc:"Hypothesize ways in which art influences perception and understanding of human experiences (HS Proficient)" },
      { code:"VA:Re8.1.HSI",   desc:"Interpret an artwork by analyzing relevant contextual information, subject matter, visual elements, and use of media (HS Proficient)" },
      { code:"VA:Cn10.1.HSI",  desc:"Document the process of developing ideas from early stages to fully elaborated ideas (HS Proficient)" },
      { code:"VA:Cr1.2.HSII",  desc:"Choose from a range of materials and methods of traditional and contemporary artistic practices to plan works of art and design (HS Accomplished)" },
      { code:"VA:Cr2.3.HSII",  desc:"Redesign an object, system, place, or design in response to contemporary issues (HS Accomplished)" },
      { code:"VA:Re9.1.HSII",  desc:"Determine the relevance of criteria used by others to evaluate a work of art or collection (HS Accomplished)" },
      { code:"VA:Cn11.1.HSII", desc:"Compare uses of art in a variety of societal, cultural, and historical contexts and make connections to uses of art in contemporary and local contexts (HS Accomplished)" },
      { code:"VA:Cr3.1.HSIII", desc:"Reflect on, re-engage, revise, and refine works of art or design considering relevant traditional and contemporary criteria as well as personal artistic vision (HS Advanced)" },
      { code:"VA:Pr6.1.HSIII", desc:"Curate a collection of objects, artifacts, or artwork to affect the viewer's understanding of social, cultural, and/or political experiences (HS Advanced)" },
    ],
  },
  // ── NYS Arts Standards (2017) — Music ─────────────────────────────────
  "Music": {
    "Pre-K – 2": [
      { code:"MU:Cr1.1.PK", desc:"With substantial guidance, explore and experience a variety of music (Pre-K)" },
      { code:"MU:Cr1.1.K",  desc:"With guidance, explore and experience music concepts (such as beat and melodic contour) (K)" },
      { code:"MU:Cr2.1.K",  desc:"With guidance, demonstrate and choose favorite musical ideas (K)" },
      { code:"MU:Cr3.1.K",  desc:"With guidance, apply personal, peer, and teacher feedback in refining personal musical ideas (K)" },
      { code:"MU:Pr4.1.K",  desc:"With guidance, demonstrate and state preference for varied musical selections (K)" },
      { code:"MU:Pr5.1.K",  desc:"With guidance, apply personal, teacher, and peer feedback to refine performances (K)" },
      { code:"MU:Pr6.1.K",  desc:"With guidance, perform music with expression (K)" },
      { code:"MU:Re7.1.K",  desc:"With guidance, list personal interests and experiences and demonstrate why they prefer some music selections over others (K)" },
      { code:"MU:Re8.1.K",  desc:"With guidance, demonstrate awareness of expressive qualities (such as voice quality, dynamics, and tempo) that reflect creators'/performers' expressive intent (K)" },
      { code:"MU:Cn10.0.K", desc:"Demonstrate how interests, knowledge, and skills relate to personal choices and intent when creating, performing, and responding to music (K)" },
      { code:"MU:Cr1.1.1",  desc:"With limited guidance, create musical ideas (such as answering a musical question) for a specific purpose (Gr 1)" },
      { code:"MU:Pr4.2.1",  desc:"With limited guidance, demonstrate knowledge of music concepts (such as beat and melodic contour) in music from a variety of cultures (Gr 1)" },
      { code:"MU:Cr2.1.2",  desc:"Demonstrate and explain personal reasons for selecting musical ideas that represent expressive intent (Gr 2)" },
      { code:"MU:Re9.1.2",  desc:"Apply personal and expressive preferences in the evaluation of music for specific purposes (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"MU:Cr1.1.3",  desc:"Improvise rhythmic and melodic ideas, and describe connection to specific purpose and context (Gr 3)" },
      { code:"MU:Cr2.1.3",  desc:"Demonstrate selected musical ideas for a simple improvisation or composition to express intent (Gr 3)" },
      { code:"MU:Pr4.1.3",  desc:"Demonstrate and explain how the selection of music to perform is influenced by personal interest, knowledge, purpose, and context (Gr 3)" },
      { code:"MU:Pr5.1.3",  desc:"Apply teacher-provided and collaboratively-developed criteria and feedback to evaluate accuracy of ensemble performances (Gr 3)" },
      { code:"MU:Pr6.1.3",  desc:"Perform music with expression and technical accuracy (Gr 3)" },
      { code:"MU:Re7.2.3",  desc:"Demonstrate and describe how a response to music can be informed by the structure, the use of the elements of music, and context (such as personal and social) (Gr 3)" },
      { code:"MU:Re8.1.3",  desc:"Demonstrate and describe how the expressive qualities are used in performers' interpretations to reflect expressive intent (Gr 3)" },
      { code:"MU:Cn11.0.3", desc:"Demonstrate understanding of relationships between music and the other arts, other disciplines, varied contexts, and daily life (Gr 3)" },
      { code:"MU:Cr3.1.4",  desc:"Evaluate, refine, and document revisions to personal musical ideas, applying teacher-provided and collaboratively developed criteria and feedback (Gr 4)" },
      { code:"MU:Pr4.2.4",  desc:"Demonstrate understanding of the structure and elements of music (such as rhythm, pitch, and form) in music selected for performance (Gr 4)" },
      { code:"MU:Re9.1.5",  desc:"Evaluate musical works and performances, applying established criteria, and explain appropriateness to the context (Gr 5)" },
      { code:"MU:Cn10.0.5", desc:"Demonstrate how interests, knowledge, and skills relate to personal choices and intent when creating, performing, and responding to music (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"MU:Cr1.1.6",  desc:"Generate simple rhythmic, melodic, and harmonic phrases within AB and ABA forms that convey expressive intent (Gr 6)" },
      { code:"MU:Cr2.1.6",  desc:"Select, organize, construct, and document personal musical ideas for arrangements and compositions within AB or ABA form (Gr 6)" },
      { code:"MU:Pr4.3.6",  desc:"Perform a selected piece of music demonstrating how their interpretations of the elements of music and the expressive qualities convey intent (Gr 6)" },
      { code:"MU:Re7.2.6",  desc:"Describe how the elements of music and expressive qualities relate to the structure of the pieces (Gr 6)" },
      { code:"MU:Cn11.0.6", desc:"Demonstrate understanding of relationships between music and the other arts, other disciplines, varied contexts, and daily life (Gr 6)" },
      { code:"MU:Cr3.2.7",  desc:"Present the final version of their documented personal composition or arrangement, using craftsmanship and originality to demonstrate an effective beginning, middle, and ending (Gr 7)" },
      { code:"MU:Pr5.3.7",  desc:"Using established criteria and feedback, identify the way(s) in which performances convey the elements of music, style, and mood (Gr 7)" },
      { code:"MU:Re9.1.8",  desc:"Apply appropriate personally-developed criteria to evaluate musical works or performances (Gr 8)" },
    ],
    "Grades 9 – 12": [
      { code:"MU:Cr1.1.HSI",  desc:"Describe and demonstrate multiple ways in which sounds and musical ideas can be used to represent extra-musical ideas (HS Proficient)" },
      { code:"MU:Cr2.1.HSI",  desc:"Select and develop draft melodies, rhythmic passages, and arrangements for specific purposes that demonstrate understanding of characteristic(s) of music or text(s) studied in rehearsal (HS Proficient)" },
      { code:"MU:Pr4.3.HSI",  desc:"Demonstrate an understanding of context in a varied repertoire of music through prepared and improvised performances (HS Proficient)" },
      { code:"MU:Pr6.1.HSI",  desc:"Demonstrate attention to technical accuracy and expressive qualities in prepared and improvised performances of a varied repertoire of music (HS Proficient)" },
      { code:"MU:Re7.2.HSII", desc:"Explain how the analysis of passages and understanding the way the elements of music are manipulated inform the response to music (HS Accomplished)" },
      { code:"MU:Cn11.0.HSI", desc:"Demonstrate understanding of relationships between music and the other arts, other disciplines, varied contexts, and daily life (HS Proficient)" },
    ],
  },
  // ── NYS Arts Standards (2017) — Theatre ───────────────────────────────
  "Theatre": {
    "Pre-K – 2": [
      { code:"TH:Cr1.1.PK", desc:"With prompting and support, transition between imagination and reality in dramatic play or a guided drama experience (Pre-K)" },
      { code:"TH:Cr1.1.K",  desc:"Propose potential choices characters can make in dramatic play or a guided drama experience (K)" },
      { code:"TH:Cr2.1.K",  desc:"With prompting and support, contribute to the development of a sequential plot in a guided drama experience (K)" },
      { code:"TH:Cr3.1.K",  desc:"With prompting and support, answer questions in dramatic play or a guided drama experience (K)" },
      { code:"TH:Pr4.1.K",  desc:"With prompting and support, identify characters and setting in dramatic play or a guided drama experience (K)" },
      { code:"TH:Pr6.1.K",  desc:"With prompting and support, engage in dramatic play or a guided drama experience (K)" },
      { code:"TH:Re7.1.K",  desc:"With prompting and support, express an emotional response to characters in dramatic play or a guided drama experience (K)" },
      { code:"TH:Cn10.1.K", desc:"With prompting and support, identify similarities between characters and oneself in dramatic play or a guided drama experience (K)" },
      { code:"TH:Cr1.1.1",  desc:"Propose potential new details to plot and story in a guided drama experience (Gr 1)" },
      { code:"TH:Pr5.1.2",  desc:"Demonstrate the relationship between body, voice, and mind in a guided drama experience (Gr 2)" },
      { code:"TH:Re9.1.2",  desc:"Collaborate on a scene in a guided drama experience (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"TH:Cr1.1.3",  desc:"Create roles, imagined worlds, and improvised stories in a drama/theatre work (Gr 3)" },
      { code:"TH:Cr2.1.3",  desc:"Participate in methods of investigation to devise original ideas for a drama/theatre work (Gr 3)" },
      { code:"TH:Cr3.1.3",  desc:"Collaborate with peers to revise, refine, and adapt ideas to fit the given parameters of a drama/theatre work (Gr 3)" },
      { code:"TH:Pr4.1.3",  desc:"Apply the elements of dramatic structure to a story and create a drama/theatre work (Gr 3)" },
      { code:"TH:Pr6.1.3",  desc:"Practice drama/theatre work and share reflections individually and in small groups (Gr 3)" },
      { code:"TH:Re7.1.4",  desc:"Identify artistic choices made in a drama/theatre work through participation and observation (Gr 4)" },
      { code:"TH:Cr1.1.5",  desc:"Identify physical qualities that might reveal a character's inner traits in the imagined world of a drama/theatre work (Gr 5)" },
      { code:"TH:Cn11.1.5", desc:"Investigate historical, global, and social issues expressed in drama/theatre work (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"TH:Cr1.1.6",  desc:"Identify possible solutions to staging challenges in a drama/theatre work (Gr 6)" },
      { code:"TH:Cr2.1.6",  desc:"Use critical analysis to improve, refine, and evolve original ideas into artistic goals in a drama/theatre work (Gr 6)" },
      { code:"TH:Pr4.1.6",  desc:"Identify the essential events in a story or script that make up the dramatic structure in a drama/theatre work (Gr 6)" },
      { code:"TH:Pr5.1.7",  desc:"Participate in a variety of acting exercises and techniques that can be applied in a rehearsal or drama/theatre performance (Gr 7)" },
      { code:"TH:Re8.1.7",  desc:"Identify the artistic choices made based on personal experience in a drama/theatre work (Gr 7)" },
      { code:"TH:Cr3.1.8",  desc:"Use repetition and analysis in order to revise devised or scripted drama/theatre work (Gr 8)" },
      { code:"TH:Cn11.2.8", desc:"Identify and discuss the connection and relevance of a drama/theatre work to contemporary issues (Gr 8)" },
    ],
    "Grades 9 – 12": [
      { code:"TH:Cr1.1.HSI",  desc:"Apply basic research to construct ideas about the visual composition of a drama/theatre work (HS Proficient)" },
      { code:"TH:Cr2.1.HSI",  desc:"Explore the function of history and culture in the development of a dramatic concept (HS Proficient)" },
      { code:"TH:Pr4.1.HSI",  desc:"Examine how character relationships assist in telling the story of a drama/theatre work (HS Proficient)" },
      { code:"TH:Pr5.1.HSI",  desc:"Practice various acting techniques to expand skills in a rehearsal or drama/theatre performance (HS Proficient)" },
      { code:"TH:Pr6.1.HSI",  desc:"Perform a scripted drama/theatre work for a specific audience (HS Proficient)" },
      { code:"TH:Re7.1.HSI",  desc:"Respond to what is seen, felt, and heard in a drama/theatre work to develop criteria for artistic choices (HS Proficient)" },
      { code:"TH:Re9.1.HSII", desc:"Analyze and assess a drama/theatre work by connecting it to art forms, history, culture, and other disciplines (HS Accomplished)" },
      { code:"TH:Cn10.1.HSI", desc:"Investigate how cultural perspectives, community ideas, and personal beliefs impact a drama/theatre work (HS Proficient)" },
    ],
  },
  // ── NYS Arts Standards (2017) — Dance ─────────────────────────────────
  "Dance": {
    "Pre-K – 2": [
      { code:"DA:Cr1.1.PK", desc:"Respond in movement to a variety of stimuli (e.g., music/sound, text, objects, images, symbols, observed dance) (Pre-K)" },
      { code:"DA:Cr1.1.K",  desc:"Respond in movement to a variety of sensory stimuli; identify an idea or feeling to develop into a dance phrase (K)" },
      { code:"DA:Cr2.1.K",  desc:"Improvise dance that has a beginning, middle, and end (K)" },
      { code:"DA:Cr3.1.K",  desc:"Apply suggestions for changing movement through guided improvisational experiences (K)" },
      { code:"DA:Pr4.1.K",  desc:"Demonstrate same-side and cross-body locomotor and non-locomotor movements (K)" },
      { code:"DA:Pr5.1.K",  desc:"Demonstrate a range of locomotor and non-locomotor movements, body patterning, and dance sequences (K)" },
      { code:"DA:Pr6.1.K",  desc:"Dance for and with others in a designated space (K)" },
      { code:"DA:Re7.1.K",  desc:"Find a movement that repeats in a dance (K)" },
      { code:"DA:Cn10.1.K", desc:"Recognize an emotion expressed in dance movement that is watched or performed (K)" },
      { code:"DA:Cr1.1.2",  desc:"Explore movement inspired by a variety of stimuli and identify the source (Gr 2)" },
      { code:"DA:Pr5.1.2",  desc:"Demonstrate clear directionality and intent when performing locomotor and non-locomotor movements (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"DA:Cr1.1.3",  desc:"Experiment with a variety of self-identified stimuli for movement (Gr 3)" },
      { code:"DA:Cr2.1.3",  desc:"Identify and experiment with choreographic devices to create simple movement patterns and dance structures (Gr 3)" },
      { code:"DA:Pr4.1.3",  desc:"Judge spaces as distance traveled and use space three-dimensionally; demonstrate shapes with positive and negative space (Gr 3)" },
      { code:"DA:Pr6.1.4",  desc:"Demonstrate the ability to adapt dance to alternative performance venues by modifying spacing and movements (Gr 4)" },
      { code:"DA:Re8.1.5",  desc:"Interpret meaning in a dance based on its movements; explain how the movement choices suggest ideas (Gr 5)" },
      { code:"DA:Cn11.1.5", desc:"Describe how dance from a culture, society, historical period, or community reveals the ideas of the people from whom the dance originates (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"DA:Cr1.1.6",  desc:"Relate similar or contrasting ideas to develop choreography using a variety of stimuli (Gr 6)" },
      { code:"DA:Cr2.1.6",  desc:"Explore choreographic devices and dance structures to develop a dance study with a clear intent (Gr 6)" },
      { code:"DA:Pr4.2.6",  desc:"Refine partner and ensemble skills in the ability to judge distance and spatial design (Gr 6)" },
      { code:"DA:Pr5.1.6",  desc:"Embody technical dance skills (e.g., alignment, coordination, balance, core support, kinesthetic awareness) (Gr 6)" },
      { code:"DA:Re7.1.7",  desc:"Compare, contrast, and discuss patterns of movement and their relationships in dance (Gr 7)" },
      { code:"DA:Re9.1.8",  desc:"Use established artistic criteria to discuss the characteristics of dances that make them unique (Gr 8)" },
      { code:"DA:Cn10.1.8", desc:"Investigate two contrasting topics through a variety of research methods; identify and compare ideas to inspire three-dimensional movement (Gr 8)" },
    ],
    "Grades 9 – 12": [
      { code:"DA:Cr1.1.HSI",  desc:"Explore a variety of stimuli for sourcing movement to develop an improvisational or choreographed dance study (HS Proficient)" },
      { code:"DA:Cr2.1.HSI",  desc:"Collaborate to design a dance using choreographic devices and dance structures to support an artistic intent (HS Proficient)" },
      { code:"DA:Pr5.1.HSI",  desc:"Embody technical dance skills (e.g., functional alignment, coordination, balance, core support, clarity of movement, weight shifts, flexibility/range of motion) to replicate, recall, and execute spatial designs and musical or rhythmical dance phrases (HS Proficient)" },
      { code:"DA:Pr6.1.HSI",  desc:"Demonstrate leadership qualities (e.g., commitment, dependability, responsibility, cooperation) when preparing for performances (HS Proficient)" },
      { code:"DA:Re7.1.HSI",  desc:"Analyze recurring patterns of movement and their relationships in dance in context of artistic intent (HS Proficient)" },
      { code:"DA:Cn11.1.HSII", desc:"Analyze and discuss dances from selected genres or styles and historical time periods, and formulate reasons for the similarities and differences (HS Accomplished)" },
    ],
  },
  // ── NYS Arts Standards (2017) — Media Arts ────────────────────────────
  "Media Arts": {
    "Pre-K – 2": [
      { code:"MA:Cr1.1.PK", desc:"With guidance, discover and share ideas for media artworks using play and experimentation (Pre-K)" },
      { code:"MA:Cr1.1.K",  desc:"Discover and share ideas for media artworks using play and experimentation (K)" },
      { code:"MA:Cr2.1.K",  desc:"With guidance, form ideas into plans or models for media arts productions (K)" },
      { code:"MA:Cr3.1.K",  desc:"With guidance, create, capture, and assemble media arts content for media arts productions (K)" },
      { code:"MA:Pr4.1.K",  desc:"With guidance, combine art forms and media content (such as image and sound) into a media artwork (K)" },
      { code:"MA:Pr5.1.K",  desc:"With guidance, identify and demonstrate basic skills (such as handling tools, making choices) in art-making (K)" },
      { code:"MA:Pr6.1.K",  desc:"With guidance, identify and share roles and the situation in presenting media artworks (K)" },
      { code:"MA:Re7.1.K",  desc:"With guidance, identify components and messages in media artworks (K)" },
      { code:"MA:Cn10.1.K", desc:"With guidance, use personal experiences in making media artworks (K)" },
      { code:"MA:Cn11.1.2", desc:"Discuss and describe media artworks in everyday life (such as popular media), and connections with family and friends (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"MA:Cr1.1.3",  desc:"Develop multiple ideas for media artworks using a variety of tools, methods and/or materials (Gr 3)" },
      { code:"MA:Cr2.1.3",  desc:"Form, share, and test ideas, plans, and models to prepare for media artworks (Gr 3)" },
      { code:"MA:Cr3.1.3",  desc:"Construct and assemble content for unified media arts productions, considering theme and unity (Gr 3)" },
      { code:"MA:Pr4.1.4",  desc:"Demonstrate how a variety of academic, arts, and media forms and content may be mixed and coordinated into media artworks (Gr 4)" },
      { code:"MA:Pr5.1.4",  desc:"Enact identified roles to practice foundational artistic, design, technical, and soft skills (such as expression, planning, and collaboration) in media arts productions (Gr 4)" },
      { code:"MA:Re7.1.5",  desc:"Identify, describe, and differentiate how message and meaning are created by components in media artworks (Gr 5)" },
      { code:"MA:Cn10.1.5", desc:"Access and use internal and external resources to create media artworks, such as interests, knowledge, and experiences (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"MA:Cr1.1.6",  desc:"Formulate variations of goals and solutions for media artworks by practicing chosen creative processes (Gr 6)" },
      { code:"MA:Cr2.1.6",  desc:"Develop, present, and test ideas, plans, models, and proposals for media arts productions, considering purposeful intent (Gr 6)" },
      { code:"MA:Pr4.1.7",  desc:"Integrate multiple contents and forms into unified media arts productions that convey consistent perspectives and narratives (Gr 7)" },
      { code:"MA:Pr5.1.7",  desc:"Exhibit an increasing set of artistic, design, technical, and soft skills, such as resolving conflicts, in managing and producing media artworks (Gr 7)" },
      { code:"MA:Re8.1.7",  desc:"Analyze how a variety of media artworks manage audience experience, create intention and persuasion through multimodal perception (Gr 7)" },
      { code:"MA:Cn11.1.8", desc:"Demonstrate and explain how media artworks and ideas relate to various contexts, purposes, and values, such as social trends, power, equality, and personal/cultural identity (Gr 8)" },
    ],
    "Grades 9 – 12": [
      { code:"MA:Cr1.1.HSI",  desc:"Use identified generative methods to formulate multiple ideas, develop artistic goals, and problem solve in media arts creation processes (HS Proficient)" },
      { code:"MA:Cr2.1.HSI",  desc:"Apply aesthetic criteria in developing, proposing, and refining artistic ideas, plans, prototypes, and production processes for media arts productions (HS Proficient)" },
      { code:"MA:Pr4.1.HSI",  desc:"Integrate various arts, media arts forms, and content into unified media arts productions, considering the reaction and interaction of the audience, advanced systems, and presentation contexts (HS Proficient)" },
      { code:"MA:Pr5.1.HSI",  desc:"Demonstrate progression in artistic, design, technical, and soft skills as a result of selecting and fulfilling specified roles in the production of a variety of media artworks (HS Proficient)" },
      { code:"MA:Re7.1.HSI",  desc:"Analyze the qualities of and relationships between the components, style, and preferences communicated by media artworks and artists (HS Proficient)" },
      { code:"MA:Cn11.1.HSII", desc:"Critically evaluate and effectively use legal, ethical, social, and aesthetic values in media arts; explore and analyze the use of media artworks in shaping societal values (HS Accomplished)" },
    ],
  },
  // ── NYS K-12 Computer Science & Digital Fluency Standards (2020) ──────
  "Computer Science & Digital Fluency": {
    "Pre-K – 2": [
      { code:"K-1.CT.1",  desc:"Identify and describe a sequence of steps as an algorithm (Computational Thinking, K–1)" },
      { code:"K-1.CT.2",  desc:"Develop, test, and modify a plan or algorithm with multiple steps to complete a task (K–1)" },
      { code:"K-1.CT.5",  desc:"Identify a problem or task and break it down into smaller parts (K–1)" },
      { code:"K-1.CT.7",  desc:"Identify and explain bugs (problems) in an existing program or algorithm and identify the cause (K–1)" },
      { code:"K-1.NSD.1", desc:"Identify and use common types of computing devices and their components (Networks & System Design, K–1)" },
      { code:"K-1.DL.1",  desc:"Use a digital device to organize, retrieve, save, and share information (Digital Literacy, K–1)" },
      { code:"K-1.DL.2",  desc:"Identify common features of digital technologies and use vocabulary to describe them (K–1)" },
      { code:"K-1.DL.4",  desc:"Conduct basic keyword searches to gather information (K–1)" },
      { code:"K-1.DL.6",  desc:"Identify if information is accurate, considering the source (K–1)" },
      { code:"K-1.IC.1",  desc:"Identify and describe positive and negative ways technology impacts daily life (Impacts of Computing, K–1)" },
      { code:"K-1.CY.1",  desc:"Identify and describe what types of personal information should not be shared with others online (Cybersecurity, K–1)" },
      { code:"2-3.CT.1",  desc:"Use a sequence of steps and instructions to write an algorithm to complete a task (Gr 2–3)" },
      { code:"2-3.CT.4",  desc:"Identify pieces of information that might change as a program or process runs (Gr 2–3)" },
      { code:"2-3.DL.4",  desc:"Conduct keyword searches with multiple search terms to gather information (Gr 2–3)" },
      { code:"2-3.IC.1",  desc:"Compare and contrast how people lived and worked before and after the adoption of new computing technologies (Gr 2–3)" },
      { code:"2-3.CY.1",  desc:"Explain why someone should only access digital information, devices, and accounts they have permission to use (Gr 2–3)" },
    ],
    "Grades 3 – 5": [
      { code:"4-6.CT.1",  desc:"Develop, test, and modify a plan or algorithm by decomposing a task into a sequence of steps (Gr 4–6)" },
      { code:"4-6.CT.2",  desc:"Identify and use repetition (loops) within an algorithm or program (Gr 4–6)" },
      { code:"4-6.CT.3",  desc:"Use selection (conditional statements) within an algorithm or program (Gr 4–6)" },
      { code:"4-6.CT.5",  desc:"Identify pieces of information that may change as a program runs (variables) (Gr 4–6)" },
      { code:"4-6.CT.7",  desc:"Identify, debug, and explain reasons for errors in an algorithm or program (Gr 4–6)" },
      { code:"4-6.NSD.1", desc:"Model how computer hardware and software work together to perform tasks (Gr 4–6)" },
      { code:"4-6.NSD.4", desc:"Model how data is structured to transmit through networks (Gr 4–6)" },
      { code:"4-6.DL.1",  desc:"Type on a keyboard while demonstrating proper keyboarding technique (Gr 4–6)" },
      { code:"4-6.DL.4",  desc:"Conduct advanced keyword searches with appropriate filters to find relevant information (Gr 4–6)" },
      { code:"4-6.DL.6",  desc:"Use various digital tools to evaluate the credibility of information sources (Gr 4–6)" },
      { code:"4-6.DL.7",  desc:"Identify and describe how attribution and intellectual property concepts apply to digital content (Gr 4–6)" },
      { code:"4-6.IC.1",  desc:"Describe how computing technologies have changed the world and express how computing technologies influence/are influenced by cultural practices (Gr 4–6)" },
      { code:"4-6.IC.3",  desc:"Identify and explain ways to improve the accessibility and usability of a computing technology product (Gr 4–6)" },
      { code:"4-6.CY.1",  desc:"Describe common safeguards for protecting personal information (Gr 4–6)" },
      { code:"4-6.CY.2",  desc:"Describe common types of cyber attacks and explain how they affect digital systems (Gr 4–6)" },
    ],
    "Grades 6 – 8": [
      { code:"7-8.CT.1",  desc:"Design an algorithm using a combination of repetition, conditionals, and the manipulation of variables (Gr 7–8)" },
      { code:"7-8.CT.2",  desc:"Decompose a problem into smaller named subproblems and use the subproblems to design a solution (Gr 7–8)" },
      { code:"7-8.CT.3",  desc:"Identify pieces of information that might change as a program runs (i.e., variables); identify decisions/choices the program will make (Gr 7–8)" },
      { code:"7-8.CT.5",  desc:"Design and iteratively develop a program that combines control structures, including nested loops and compound conditionals (Gr 7–8)" },
      { code:"7-8.CT.6",  desc:"Identify multiple algorithms for the same task and discuss the trade-offs between them (Gr 7–8)" },
      { code:"7-8.NSD.1", desc:"Design a project that combines hardware and software components to collect and exchange data (Gr 7–8)" },
      { code:"7-8.NSD.4", desc:"Model and explain how information is broken down, sent, reassembled, and received between two devices on a network (Gr 7–8)" },
      { code:"7-8.DL.1",  desc:"Type proficiently on a keyboard (Gr 7–8)" },
      { code:"7-8.DL.4",  desc:"Use advanced search strategies (filters, Boolean operators) to find appropriate information (Gr 7–8)" },
      { code:"7-8.DL.6",  desc:"Evaluate digital information sources for accuracy, relevance, bias, and origin (Gr 7–8)" },
      { code:"7-8.DL.7",  desc:"Apply ethical reasoning to use, attribute, and license content (Gr 7–8)" },
      { code:"7-8.IC.1",  desc:"Describe approaches and rationale for revising and innovating on existing technologies to increase benefits and reduce risks (Gr 7–8)" },
      { code:"7-8.IC.4",  desc:"Identify and discuss issues of ethics related to computing technologies and current events (Gr 7–8)" },
      { code:"7-8.CY.1",  desc:"Explain reasons to be aware of and protect against cyber threats (Gr 7–8)" },
      { code:"7-8.CY.2",  desc:"Describe common types of malicious actors, methods of attack, and the role of security professionals (Gr 7–8)" },
      { code:"7-8.CY.4",  desc:"Explain how the use of strong passwords and authentication helps protect digital information (Gr 7–8)" },
    ],
    "Grades 9 – 12": [
      { code:"9-12.CT.1",  desc:"Develop, refine, and use a series of collaborative steps and tools to design and implement a computational artifact (Gr 9–12)" },
      { code:"9-12.CT.2",  desc:"Decompose a problem into smaller subproblems by using procedures (procedural abstraction) (Gr 9–12)" },
      { code:"9-12.CT.3",  desc:"Use and adapt classic algorithms to solve computational problems (Gr 9–12)" },
      { code:"9-12.CT.4",  desc:"Compare algorithms that solve the same problem and identify which is the most appropriate (Gr 9–12)" },
      { code:"9-12.CT.6",  desc:"Design and iteratively develop a computational artifact for a specific audience (Gr 9–12)" },
      { code:"9-12.CT.7",  desc:"Use a development process to systematically create programs (Gr 9–12)" },
      { code:"9-12.CT.8",  desc:"Develop programs that use abstraction and procedures to solve problems (Gr 9–12)" },
      { code:"9-12.NSD.1", desc:"Compare different hardware/software combinations and recommend selection based on user needs (Gr 9–12)" },
      { code:"9-12.NSD.4", desc:"Categorize and describe the different types of networks and explain how data is sent through multiple paths (Gr 9–12)" },
      { code:"9-12.DL.4",  desc:"Use a variety of digital tools and resources to create digital artifacts (Gr 9–12)" },
      { code:"9-12.DL.6",  desc:"Communicate and work collaboratively with others using digital tools to support individual learning and contribute to the learning of others (Gr 9–12)" },
      { code:"9-12.IC.1",  desc:"Evaluate the impact of computing technologies on equity, access, and influence in a global society (Gr 9–12)" },
      { code:"9-12.IC.4",  desc:"Debate laws and regulations that impact the development and use of software (Gr 9–12)" },
      { code:"9-12.IC.5",  desc:"Evaluate the beneficial and harmful effects that computing innovations have had on society (Gr 9–12)" },
      { code:"9-12.CY.1",  desc:"Develop and communicate multi-step strategies for protecting personal computing devices and digital identity (Gr 9–12)" },
      { code:"9-12.CY.2",  desc:"Describe physical, digital, and behavioral safeguards used by individuals and organizations to defend against cyber attacks (Gr 9–12)" },
      { code:"9-12.CY.4",  desc:"Explain how encryption and authentication can secure information from unauthorized access (Gr 9–12)" },
    ],
  },
  // ── NYS Physical Education Standards ──────────────────────────────────
  "Physical Education": {
    "Pre-K – 2": [
      { code:"NYSPE.E.1.1", desc:"Perform basic motor and locomotor skills (e.g., walk, run, hop, jump, skip, gallop, slide) (Elementary)" },
      { code:"NYSPE.E.1.2", desc:"Perform non-locomotor skills (bend, twist, turn, balance) and manipulative skills (throw, catch, kick, strike) at developmentally appropriate levels (Elementary)" },
      { code:"NYSPE.E.1.3", desc:"Demonstrate awareness of body, space, effort, and relationships while moving (Elementary)" },
      { code:"NYSPE.E.2.1", desc:"Recognize that regular physical activity contributes to good health and well-being (Elementary)" },
      { code:"NYSPE.E.2.2", desc:"Describe and demonstrate components of health-related fitness (cardiorespiratory endurance, muscular strength, flexibility) (Elementary)" },
      { code:"NYSPE.E.3.1", desc:"Demonstrate cooperative and respectful behavior during physical activity, including following rules and safety procedures (Elementary)" },
    ],
    "Grades 3 – 5": [
      { code:"NYSPE.E.1.4", desc:"Combine locomotor, non-locomotor, and manipulative skills in modified games, dance, and gymnastic activities (Gr 3–5)" },
      { code:"NYSPE.E.1.5", desc:"Apply movement concepts (force, time, space, flow) to improve motor skill performance (Gr 3–5)" },
      { code:"NYSPE.E.2.3", desc:"Participate regularly in moderate-to-vigorous physical activity in and out of school (Gr 3–5)" },
      { code:"NYSPE.E.2.4", desc:"Identify and self-monitor health-related fitness components using simple assessments (Gr 3–5)" },
      { code:"NYSPE.E.3.2", desc:"Demonstrate teamwork, fair play, leadership, and respect for individual differences during activity (Gr 3–5)" },
    ],
    "Grades 6 – 8": [
      { code:"NYSPE.I.1.1", desc:"Demonstrate competence in selected motor skills and movement patterns needed to participate in a variety of physical activities (Intermediate)" },
      { code:"NYSPE.I.1.2", desc:"Apply tactical concepts and strategies in modified game play, dance, and individual/team activities (Intermediate)" },
      { code:"NYSPE.I.2.1", desc:"Design and implement a personal fitness plan based on assessment of health-related fitness components (Intermediate)" },
      { code:"NYSPE.I.2.2", desc:"Analyze the relationship between physical activity, nutrition, and a healthy lifestyle (Intermediate)" },
      { code:"NYSPE.I.3.1", desc:"Apply rules, safety, etiquette, leadership, and teamwork in physical activity settings (Intermediate)" },
      { code:"NYSPE.I.3.2", desc:"Identify the social and emotional benefits of participating in physical activity (Intermediate)" },
    ],
    "Grades 9 – 12": [
      { code:"NYSPE.C.1.1", desc:"Demonstrate competence and proficiency in selected lifetime activities (e.g., fitness, sport, dance, outdoor pursuits) (Commencement)" },
      { code:"NYSPE.C.1.2", desc:"Apply advanced tactical strategies, biomechanics, and movement principles to improve performance (Commencement)" },
      { code:"NYSPE.C.2.1", desc:"Develop, implement, and evaluate a personal fitness program using FITT principles and training concepts (Commencement)" },
      { code:"NYSPE.C.2.2", desc:"Analyze the impact of lifetime physical activity choices on long-term health, disease prevention, and stress management (Commencement)" },
      { code:"NYSPE.C.3.1", desc:"Demonstrate responsible personal and social behavior, including leadership, ethical conduct, and respect for diversity, in physical activity settings (Commencement)" },
      { code:"NYSPE.C.3.2", desc:"Evaluate community, recreational, and career opportunities related to physical activity, fitness, and wellness (Commencement)" },
    ],
  },
  // ── NYS Health Education Standards ────────────────────────────────────
  "Health Education": {
    "Pre-K – 2": [
      { code:"NYSHE.E.1.1", desc:"Identify basic personal health and hygiene practices (handwashing, dental care, sleep, nutrition) and explain why they matter (Elementary)" },
      { code:"NYSHE.E.1.2", desc:"Identify physical, social, and emotional components of health and well-being (Elementary)" },
      { code:"NYSHE.E.1.3", desc:"Recognize trusted adults and know how to ask for help in unsafe or uncomfortable situations (Elementary)" },
      { code:"NYSHE.E.2.1", desc:"Identify how family, peers, school, culture, media, and technology influence health behaviors (Elementary)" },
      { code:"NYSHE.E.3.1", desc:"Use age-appropriate strategies to communicate needs, wants, and feelings respectfully (Elementary)" },
    ],
    "Grades 3 – 5": [
      { code:"NYSHE.E.1.4", desc:"Describe health-promoting behaviors related to nutrition, physical activity, sleep, and personal safety (Gr 3–5)" },
      { code:"NYSHE.E.1.5", desc:"Identify warning signs and protective factors related to substance use, violence, bullying, and unsafe relationships (Gr 3–5)" },
      { code:"NYSHE.E.2.2", desc:"Analyze how media and advertising influence personal health choices (Gr 3–5)" },
      { code:"NYSHE.E.3.2", desc:"Demonstrate refusal, conflict resolution, and decision-making skills in age-appropriate situations (Gr 3–5)" },
    ],
    "Grades 6 – 8": [
      { code:"NYSHE.I.1.1", desc:"Analyze how personal choices, behaviors, and environments affect physical, mental, emotional, and social health (Intermediate)" },
      { code:"NYSHE.I.1.2", desc:"Explain the importance of nutrition, physical activity, sleep, and stress management in preventing chronic disease (Intermediate)" },
      { code:"NYSHE.I.1.3", desc:"Describe the short- and long-term consequences of substance use, including alcohol, tobacco, vaping, and other drugs (Intermediate)" },
      { code:"NYSHE.I.1.4", desc:"Demonstrate understanding of healthy relationships, consent, boundaries, and recognizing unhealthy/abusive behaviors (Intermediate)" },
      { code:"NYSHE.I.2.1", desc:"Evaluate the validity of health information, products, and services from a variety of sources (Intermediate)" },
      { code:"NYSHE.I.3.1", desc:"Apply effective communication, refusal, decision-making, and goal-setting skills to enhance health (Intermediate)" },
    ],
    "Grades 9 – 12": [
      { code:"NYSHE.C.1.1", desc:"Analyze the relationship between healthy behaviors and prevention of chronic disease, injury, and premature death (Commencement)" },
      { code:"NYSHE.C.1.2", desc:"Evaluate strategies to manage stress, anxiety, depression, and other mental health concerns and identify when/how to seek help (Commencement)" },
      { code:"NYSHE.C.1.3", desc:"Analyze influences (cultural, family, peer, media, technology) on health behaviors across the lifespan (Commencement)" },
      { code:"NYSHE.C.1.4", desc:"Demonstrate knowledge of comprehensive sexual health: anatomy, reproduction, contraception, STI prevention, consent, and healthy relationships (Commencement)" },
      { code:"NYSHE.C.2.1", desc:"Access and evaluate valid health information, products, services, and community resources (Commencement)" },
      { code:"NYSHE.C.3.1", desc:"Use advocacy, decision-making, and goal-setting skills to promote personal, family, and community health (Commencement)" },
    ],
  },
  // ── NYS Family & Consumer Sciences Standards ──────────────────────────
  "Family & Consumer Sciences": {
    "Pre-K – 2": [
      { code:"NYSFACS.E.1.1", desc:"Identify roles and responsibilities of family members and how families care for one another (Elementary)" },
      { code:"NYSFACS.E.1.2", desc:"Describe basic human needs (food, clothing, shelter, safety, love) and how they are met (Elementary)" },
      { code:"NYSFACS.E.2.1", desc:"Identify safe and healthy food choices and basic kitchen/personal safety practices (Elementary)" },
      { code:"NYSFACS.E.3.1", desc:"Recognize the difference between needs and wants when making consumer choices (Elementary)" },
    ],
    "Grades 3 – 5": [
      { code:"NYSFACS.E.1.3", desc:"Describe how individual decisions affect personal, family, and community well-being (Gr 3–5)" },
      { code:"NYSFACS.E.2.2", desc:"Demonstrate basic food preparation, nutrition, and kitchen safety skills (Gr 3–5)" },
      { code:"NYSFACS.E.3.2", desc:"Practice basic consumer skills: comparing products, simple budgeting, and evaluating advertising (Gr 3–5)" },
    ],
    "Grades 6 – 8": [
      { code:"NYSFACS.I.1.1", desc:"Analyze how family structure, roles, and responsibilities change across the life span (Intermediate)" },
      { code:"NYSFACS.I.1.2", desc:"Apply human development concepts to nurture relationships with family, friends, and community (Intermediate)" },
      { code:"NYSFACS.I.2.1", desc:"Plan and prepare nutritious meals using safe food handling, sanitation, and basic culinary techniques (Intermediate)" },
      { code:"NYSFACS.I.2.2", desc:"Evaluate textiles, clothing care, and design for personal use and consumer decisions (Intermediate)" },
      { code:"NYSFACS.I.3.1", desc:"Apply personal financial literacy: budgeting, saving, banking, credit, and consumer rights/responsibilities (Intermediate)" },
      { code:"NYSFACS.I.3.2", desc:"Analyze how advertising, technology, and culture influence consumer choices (Intermediate)" },
    ],
    "Grades 9 – 12": [
      { code:"NYSFACS.C.1.1", desc:"Evaluate the impact of life decisions (career, family, parenting, education) on personal and community well-being (Commencement)" },
      { code:"NYSFACS.C.1.2", desc:"Apply principles of child development, parenting, and caregiving to support healthy growth across stages (Commencement)" },
      { code:"NYSFACS.C.2.1", desc:"Apply nutrition, food science, and culinary skills to plan and prepare meals that meet dietary, cultural, and health needs (Commencement)" },
      { code:"NYSFACS.C.2.2", desc:"Evaluate housing, interior design, and resource management for individuals and families (Commencement)" },
      { code:"NYSFACS.C.3.1", desc:"Manage personal finances: income, taxes, banking, credit, investing, insurance, and consumer protection (Commencement)" },
      { code:"NYSFACS.C.3.2", desc:"Explore career pathways related to family and consumer sciences (e.g., culinary, fashion, education, social services, hospitality) (Commencement)" },
    ],
  },
  // ── NYS CDOS — Career Development & Occupational Studies ──────────────
  "CDOS (Career Development)": {
    "Pre-K – 2": [
      { code:"CDOS.E.1.1", desc:"Begin a career awareness plan; describe interests, aptitudes, and abilities (Standard 1: Career Development, Elementary)" },
      { code:"CDOS.E.1.2", desc:"Describe the value of work to the individual and society and explore community occupations (Elementary)" },
      { code:"CDOS.E.2.1", desc:"Demonstrate how academic knowledge and skills (reading, math, communication) are used in everyday work tasks (Standard 2: Integrated Learning, Elementary)" },
      { code:"CDOS.E.3a.1", desc:"Demonstrate basic foundation skills: communicating, listening, following directions, and working with others (Standard 3a: Universal Foundation Skills, Elementary)" },
      { code:"CDOS.E.3a.2", desc:"Use simple thinking skills (problem solving, decision making) and demonstrate responsibility, self-management, and respect (Elementary)" },
    ],
    "Grades 3 – 5": [
      { code:"CDOS.E.1.3", desc:"Continue a career plan; relate personal interests, skills, and abilities to broad career interest areas (Gr 3–5)" },
      { code:"CDOS.E.2.2", desc:"Apply academic skills to real-world tasks and projects; explain how school subjects connect to careers (Gr 3–5)" },
      { code:"CDOS.E.3a.3", desc:"Use technology safely and appropriately to gather information, organize data, and communicate (Gr 3–5)" },
      { code:"CDOS.E.3a.4", desc:"Work cooperatively in groups, manage tasks, and use basic resources (time, materials, information) effectively (Gr 3–5)" },
    ],
    "Grades 6 – 8": [
      { code:"CDOS.I.1.1", desc:"Continue development of a career plan; relate personal interests, skills, and abilities to career research and decision-making (Intermediate)" },
      { code:"CDOS.I.1.2", desc:"Understand the relationship between the changing nature of work and educational/training requirements (Intermediate)" },
      { code:"CDOS.I.2.1", desc:"Apply academic knowledge and skills to solve workplace-related problems in projects, simulations, and community-based experiences (Intermediate)" },
      { code:"CDOS.I.3a.1", desc:"Demonstrate basic skills: reading, writing, listening, speaking, mathematics, and using technology in workplace contexts (Intermediate)" },
      { code:"CDOS.I.3a.2", desc:"Demonstrate thinking skills: creative thinking, decision making, problem solving, reasoning, and knowing how to learn (Intermediate)" },
      { code:"CDOS.I.3a.3", desc:"Demonstrate personal qualities: responsibility, self-esteem, sociability, self-management, integrity, and honesty (Intermediate)" },
      { code:"CDOS.I.3a.4", desc:"Work effectively with others; allocate resources (time, money, materials, people); acquire and use information (Intermediate)" },
    ],
    "Grades 9 – 12": [
      { code:"CDOS.C.1.1", desc:"Complete a career plan that permits eventual entry into a career option; apply decision-making skills in selecting a career path (Commencement)" },
      { code:"CDOS.C.1.2", desc:"Develop a résumé, cover letter, and effective interviewing techniques to gain entry into a career option (Commencement)" },
      { code:"CDOS.C.2.1", desc:"Research, design, and complete an integrated project that demonstrates application of academic knowledge in a workplace or community setting (Commencement)" },
      { code:"CDOS.C.3a.1", desc:"Apply basic, thinking, personal, interpersonal, technology, and systems-thinking skills to actual workplace situations (Commencement)" },
      { code:"CDOS.C.3a.2", desc:"Understand systems (organizational, social, technological); monitor and improve performance within them (Commencement)" },
      { code:"CDOS.C.3a.3", desc:"Use technology to acquire, process, and apply information; select appropriate technology for tasks (Commencement)" },
      { code:"CDOS.C.3b.1", desc:"For students choosing a Career Major: acquire career-specific technical knowledge and skills aligned to a chosen pathway (e.g., Business, Health Services, Engineering/Technology, Human/Public Services, Natural/Agricultural Sciences, Arts/Humanities) (Commencement)" },
      { code:"CDOS.C.3b.2", desc:"Demonstrate workplace readiness through work-based learning experiences (internships, community service, simulated workplaces) (Commencement)" },
    ],
  },
};

const IMG_STYLES = [
  { id:"cartoon",  label:"🎨 Cartoon",    prompt:"colorful cartoon illustration, child-friendly, bright colors, clean lines, simple" },
  { id:"photo",    label:"📷 Photograph", prompt:"realistic educational photograph, clear, professional quality, well-lit" },
  { id:"lineart",  label:"✏️ Line Art",   prompt:"black and white line drawing coloring page, simple clean outlines, no fill, educational worksheet" },
  { id:"clipart",  label:"🎭 Clipart",    prompt:"flat design clipart, simple vector illustration, solid colors, clean, educational" },
  { id:"diagram",  label:"📐 Diagram",    prompt:"educational labeled diagram, clear and simple, textbook style, professional illustration" },
];

const PALETTE = [
  { type:"instruction",    label:"Instructions",    emoji:"📋" },
  { type:"text",           label:"Text Block",       emoji:"📝" },
  { type:"image",          label:"Image",            emoji:"🖼️" },
  { type:"blank",          label:"Write Lines",      emoji:"✏️" },
  { type:"wordBank",       label:"Word Bank",        emoji:"📚" },
  { type:"matching",       label:"Matching",         emoji:"🔗" },
  { type:"multipleChoice", label:"Multiple Choice",  emoji:"🔘" },
  { type:"truefalse",      label:"True / False",     emoji:"✅" },
  { type:"shortAnswer",    label:"Short Answer",     emoji:"💬" },
  { type:"fillBlank",      label:"Fill in Blank",    emoji:"📌" },
  { type:"essay",          label:"Essay Prompt",     emoji:"📜" },
  { type:"table",          label:"Table / Chart",    emoji:"📊" },
  { type:"customShape",    label:"Custom Shapes",    emoji:"🔷" },
  { type:"successCriteria",label:"Success Criteria", emoji:"🎯" },
  { type:"exitTicket",     label:"Exit Ticket",      emoji:"🎟️" },
  { type:"dokQuestions",   label:"DOK Questions",    emoji:"🧠" },
  { type:"divider",        label:"Section Break",    emoji:"〰️" },
];

const uid = () => Math.random().toString(36).slice(2, 10);

// 3-col grid placement helpers — paper inner width ≈ 632px
const COLS = 3;
const COL_GAP_PCT = 2;                  // % gap between columns
const COL_W_PCT = (100 - COL_GAP_PCT * (COLS - 1)) / COLS; // ≈ 32%
const ROW_HEIGHT = 220;                 // px per row when auto-placing
const nextSlot = (count) => {
  const col = count % COLS;
  const row = Math.floor(count / COLS);
  return {
    x: col * (COL_W_PCT + COL_GAP_PCT), // % from left
    y: row * ROW_HEIGHT,                // px from top
    widthOverride: Math.round(COL_W_PCT),
  };
};

const mkEl = (type, slot) => {
  const id = uid();
  const pos = slot || { x: 0, y: 0, widthOverride: Math.round(COL_W_PCT) };
  const map = {
    instruction:    { id, type, text: "Look at each item carefully. Follow the directions below." },
    text:           { id, type, text: "Enter your text content here. This block will scale with your selected grade level." },
    image:          { id, type, url: "", caption: "", size: "medium", align: "center" },
    blank:          { id, type, label: "Write your answer:", lines: 3 },
    wordBank:       { id, type, title: "📚 Word Bank", words: ["cat", "dog", "fish", "bird", "frog"] },
    matching:       { id, type, title: "Draw a line to match!", left: ["cat 🐱", "dog 🐶", "fish 🐟"], right: ["meow", "woof", "splash"] },
    multipleChoice: { id, type, question: "Which answer is correct?", note: "Circle the correct answer.", choices: ["Option A", "Option B", "Option C", "Option D"] },
    truefalse:      { id, type, statements: ["The Earth orbits the Sun.", "Fish can breathe air.", "Water is a liquid."] },
    shortAnswer:    { id, type, question: "Answer the following question in 1–2 complete sentences.", lines: 4 },
    fillBlank:      { id, type, text: "The capital of New York is ______. It is located in ______ County.", note: "Use the Word Bank to help you." },
    essay:          { id, type, prompt: "In a well-developed paragraph, explain your answer using evidence from the text to support your ideas.", points: 10, lines: 14 },
    table:          { id, type, title: "Complete the table:", headers: ["Name", "Category", "Description"], rows: [["","",""],["","",""],["","",""]] },
    customShape:    { id, type, title: "Label each shape:", shapes: [
                        { shape:"rectangle", label:"", fill:"#FFFFFF", border:"#6D28D9", borderWidth:2, width:180, height:120, lines:0 },
                        { shape:"rectangle", label:"", fill:"#FFFFFF", border:"#6D28D9", borderWidth:2, width:180, height:120, lines:0 },
                      ], layout:"2-col" },
    successCriteria: { id, type, title: "🎯 Success Criteria", intro: "I can…", items: ["I can look at the picture.", "I can read the text.", "I can identify the character in the story."], mode: "manual" },
    exitTicket:     { id, type, title: "🎟️ Exit Ticket", intro: "Check off everything you completed today:", items: ["I participated in class.", "I completed the reading assignment.", "I participated in at least two center activities."], mode: "manual" },
    dokQuestions:   { id, type, title: "🧠 DOK Questions", intro: "Answer the questions at each level of thinking.", topic: "", mode: "manual", levels: [
      { level: 1, label: "Recall & Reproduction", items: ["Who is the main character in the story?", "Can you name the character we just read about?"] },
      { level: 2, label: "Skills & Concepts",     items: ["What does the character look like? Describe them.", "Is the character happy or sad? How do you know?"] },
      { level: 3, label: "Strategic Thinking",    items: ["Why do you think the character did that?", "What do you think the character will do next?"] },
      { level: 4, label: "Extended Thinking",     items: ["If you were the character, what would you do differently? Why?", "Tell a new story about the character. What happens next?"] },
    ] },
    divider:        { id, type },
  };
  const base = map[type] || { id, type };
  return { ...pos, ...base };
};

const PRINT_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700&family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap');
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Inter', 'Segoe UI', sans-serif; background: white; }
/* ── Accessibility: visible focus rings ── */
:focus-visible {
  outline: 3px solid #6D28D9 !important;
  outline-offset: 2px !important;
  border-radius: 4px;
}
/* ── Accessibility: reduce motion ── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
/* ── High contrast mode support ── */
@media (forced-colors: active) {
  button, select, input, textarea { border: 2px solid ButtonText !important; }
}
@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-9px)} }
@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
@keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
@media print {
  html, body { height: auto !important; overflow: visible !important; }
  .no-print { display: none !important; }
  .worksheet-paper { box-shadow: none !important; margin: 0 !important; padding: 44px 64px !important; width: 100% !important; min-height: auto !important; border-radius: 0 !important; }
  .app-shell { display: block !important; height: auto !important; overflow: visible !important; }
  .canvas-area { padding: 0 !important; overflow: visible !important; display: block !important; background: white !important; }
}
/* ── Skip nav link ── */
.skip-nav {
  position: absolute; top: -100px; left: 8px; z-index: 9999;
  background: #6D28D9; color: white; padding: 8px 16px; border-radius: 6px;
  font-family: 'Inter', sans-serif; font-weight: 700; font-size: 14px;
  text-decoration: none; transition: top 0.2s;
}
.skip-nav:focus { top: 8px; }
`;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SHARED UI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const F  = "'Inter', 'Segoe UI', sans-serif";
const FF = "'Playfair Display', Georgia, serif";
const WORKSHEET_FONTS = [
  { value: "default",                          label: "Default (grade font)" },
  { value: "'Inter', sans-serif",              label: "Inter" },
  { value: "'Nunito', sans-serif",             label: "Nunito (Friendly)" },
  { value: "Georgia, serif",                   label: "Georgia (Serif)" },
  { value: "'Times New Roman', serif",         label: "Times New Roman" },
  { value: "Arial, sans-serif",                label: "Arial" },
  { value: "'Comic Sans MS', cursive",         label: "Comic Sans" },
  { value: "'Courier New', monospace",         label: "Courier (Mono)" },
  { value: "'OpenDyslexic', sans-serif",       label: "OpenDyslexic (Accessibility)" },
];

function Btn({ children, onClick, bg = "#1E3A5F", color = "#fff", disabled, full, sm, style: xs = {}, ariaLabel }) {
  return (
    <button
      onClick={onClick} disabled={disabled}
      aria-label={ariaLabel}
      aria-disabled={disabled}
      style={{ padding: sm ? "5px 10px" : "8px 16px", borderRadius: 7, border: "none", background: bg, color, fontFamily: F, fontWeight: 600, fontSize: sm ? 12 : 13, cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.45 : 1, transition: "all 0.15s", width: full ? "100%" : undefined, letterSpacing: 0.1, ...xs }}>
      {children}
    </button>
  );
}

const LBL = { fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginTop: 14, marginBottom: 4, fontFamily: F };
const INP = () => ({ width: "100%", padding: "8px 11px", borderRadius: 7, border: "1.5px solid #D1D5DB", fontSize: 13, fontFamily: F, outline: "none", boxSizing: "border-box", color: "#111827", resize: "vertical", transition: "border 0.2s", background: "white" });

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOM SHAPE RENDERING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const SHAPE_TYPES = [
  { id:"rectangle",  label:"Rectangle" },
  { id:"rounded",    label:"Rounded Box" },
  { id:"circle",     label:"Circle" },
  { id:"oval",       label:"Oval" },
  { id:"triangle",   label:"Triangle" },
  { id:"diamond",    label:"Diamond" },
  { id:"hexagon",    label:"Hexagon" },
  { id:"star",       label:"Star" },
  { id:"speech",     label:"Speech Bubble" },
  { id:"cloud",      label:"Cloud" },
  { id:"arrow",      label:"Arrow (Right)" },
  { id:"heart",      label:"Heart" },
];

// Returns SVG <path> or shape element string for a given id, rendered into a W×H viewBox
function ShapeSVG({ shape, fill, border, borderWidth, width, height, label, lines, fontSize }) {
  const sw = borderWidth || 2;
  // Allow width="100%" or "auto" — use a numeric basis for the viewBox math
  // and let CSS scale the SVG to fit its container.
  const fluidW = typeof width === "string";
  const W = fluidW ? 240 : (width  || 180);
  const H = (typeof height === "number" ? height : parseInt(height as any)) || 120;
  const f = fill   || "#FFFFFF";
  const b = border || "#6D28D9";
  const fs = fontSize || 13;
  const lineColor = "#CBD5E1";
  const labelPad = label ? fs + 10 : 0;
  const innerTop = labelPad + 12;
  const innerH = H - innerTop - 8;
  const lineCount = lines || 0;
  const lineSpacing = lineCount > 0 ? Math.max(18, Math.floor(innerH / lineCount)) : 0;

  const shapeEl = () => {
    const p = sw / 2; // inset for stroke
    switch (shape) {
      case "rounded":
        return <rect x={p} y={p} width={W-sw} height={H-sw} rx={14} ry={14} fill={f} stroke={b} strokeWidth={sw} />;
      case "circle": {
        const cx = W/2, cy = H/2, r = Math.min(W,H)/2 - p;
        return <circle cx={cx} cy={cy} r={r} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "oval": {
        const cx = W/2, cy = H/2, rx = W/2 - p, ry = H/2 - p;
        return <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "triangle": {
        const pts = `${W/2},${p} ${W-p},${H-p} ${p},${H-p}`;
        return <polygon points={pts} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "diamond": {
        const pts = `${W/2},${p} ${W-p},${H/2} ${W/2},${H-p} ${p},${H/2}`;
        return <polygon points={pts} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "hexagon": {
        const cx=W/2, cy=H/2, r=Math.min(W,H)/2-p;
        const pts = [0,60,120,180,240,300].map(a => {
          const rad = (a-90)*Math.PI/180;
          return `${cx+r*Math.cos(rad)},${cy+r*Math.sin(rad)}`;
        }).join(" ");
        return <polygon points={pts} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "star": {
        const cx=W/2, cy=H/2, ro=Math.min(W,H)/2-p, ri=ro*0.42;
        const pts = Array.from({length:10},(_,i)=>{
          const rad = (i*36-90)*Math.PI/180;
          const r2 = i%2===0 ? ro : ri;
          return `${cx+r2*Math.cos(rad)},${cy+r2*Math.sin(rad)}`;
        }).join(" ");
        return <polygon points={pts} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "speech": {
        const r=10, tw=22, th=14;
        const d=`M${r+tw},${p} H${W-r-p} Q${W-p},${p} ${W-p},${r+p} V${H-th-r-p} Q${W-p},${H-th-p} ${W-r-p},${H-th-p} H${W/2+6} L${W/2-4},${H-p} L${W/2+2},${H-th-p} H${r+p} Q${p},${H-th-p} ${p},${H-th-r-p} V${r+p} Q${p},${p} ${r+p},${p} Z`;
        return <path d={d} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "cloud": {
        const d=`M${W*0.2},${H*0.7} Q${W*0.05},${H*0.7} ${W*0.08},${H*0.52} Q${W*0.08},${H*0.35} ${W*0.22},${H*0.35} Q${W*0.24},${H*0.18} ${W*0.42},${H*0.2} Q${W*0.5},${H*0.06} ${W*0.65},${H*0.18} Q${W*0.8},${H*0.12} ${W*0.88},${H*0.28} Q${W*0.98},${H*0.28} ${W*0.96},${H*0.46} Q${W},${H*0.6} ${W*0.88},${H*0.68} Q${W*0.88},${H*0.78} ${W*0.78},${H*0.78} H${W*0.22} Q${W*0.2},${H*0.78} ${W*0.2},${H*0.7} Z`;
        return <path d={d} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "arrow": {
        const mid=H/2, headX=W-p, bodyTop=mid-H*0.18, bodyBot=mid+H*0.18, headTop=p+4, headBot=H-p-4;
        const d=`M${p},${bodyTop} H${W*0.62} V${headTop} L${headX},${mid} L${W*0.62},${headBot} V${bodyBot} H${p} Z`;
        return <path d={d} fill={f} stroke={b} strokeWidth={sw} />;
      }
      case "heart": {
        const cx=W/2, top=H*0.22;
        const d=`M${cx},${H-p-4} C${cx-W*0.02},${H*0.78} ${p},${H*0.6} ${p},${H*0.42} C${p},${top} ${cx*0.5},${top-8} ${cx},${top+10} C${cx*1.5},${top-8} ${W-p},${top} ${W-p},${H*0.42} C${W-p},${H*0.6} ${cx+W*0.02},${H*0.78} ${cx},${H-p-4} Z`;
        return <path d={d} fill={f} stroke={b} strokeWidth={sw} />;
      }
      default: // rectangle
        return <rect x={p} y={p} width={W-sw} height={H-sw} fill={f} stroke={b} strokeWidth={sw} />;
    }
  };

  const svgWidth = fluidW ? "100%" : W;
  const svgHeight = fluidW ? H : H;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={svgWidth} height={svgHeight} preserveAspectRatio={fluidW ? "xMidYMid meet" : undefined} style={{ display:"block", overflow:"visible", maxWidth:"100%" }} aria-hidden="true">
      {shapeEl()}
      {label && (
        <text x={W/2} y={labelPad} textAnchor="middle" fontSize={fs} fontFamily="Inter,sans-serif" fontWeight="600" fill="#374151" dominantBaseline="middle">{label}</text>
      )}
      {lineCount > 0 && Array.from({length:lineCount}).map((_,i) => {
        const y = innerTop + i * lineSpacing + lineSpacing * 0.7;
        if (y > H - 8) return null;
        return <line key={i} x1={W*0.08} x2={W*0.92} y1={y} y2={y} stroke={lineColor} strokeWidth="1" />;
      })}
    </svg>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ELEMENT VIEW
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ScaledContent: wraps an element's inner content and scales it (via CSS
// transform) so that boxes, text, lines, and other inner elements grow or
// shrink together when the user resizes the outer wrapper. It measures the
// content's natural size and the available wrapper space, then applies
// transform: scale(sx, sy) with top-left origin. The outer wrapper keeps
// absolute positioning so resize handles stay anchored to its edges.
// Default baseline dimensions used to compute proportional scale factors.
// When the user has not resized an element, scale stays at 1. As they grow
// the wrapper beyond these baselines, both inner width AND inner content
// (text, boxes, lines) scale together via CSS transform.
const BASELINE_WIDTH_PCT = 32; // matches default widthOverride for new elements
const BASELINE_HEIGHT_PX = 80;

// Compute proportional scale factors for an element. Scale is allowed to go
// BELOW 1 when the user shrinks the box, so inner content (text, pills,
// boxes, lines) stays inside the wrapper instead of overflowing. A floor of
// 0.55 prevents content from becoming unreadable. Default widthOverride=32
// gives sx=1 (no change at default size).
const SCALE_MIN = 0.55;
const SCALE_MAX = 4;
const clampScale = (v) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, v));
const resizeScaleFor = (el) => {
  // Width scale is the source of truth for typography/spacing. Dividing the
  // height override by a fixed BASELINE_HEIGHT_PX (80) used to inflate `sy`
  // to SCALE_MAX for any moderately tall box, which made inner content
  // render at maximum size no matter how the box was actually sized. Now
  // both `sy` and the unified `s` track the width scale, so content always
  // scales proportionally to the box's current width. Vertical fit is
  // handled separately by ScaledContent's measured transform.
  const sx = clampScale((el.widthOverride ?? BASELINE_WIDTH_PCT) / BASELINE_WIDTH_PCT);
  return { sx, sy: sx, s: sx };
};

function ScaledContent({ el, children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [dims, setDims] = useState({ outerW: 0, naturalH: 0 });

  // Measure the outer wrapper width (which reflects widthOverride %) and the
  // natural intrinsic height of the inner content at baseline width. We render
  // the inner box at a FIXED baseline pixel width so that growing the outer
  // wrapper truly enlarges (scales up) the content rather than just reflowing
  // it to fill more horizontal space.
  useLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const measure = () => {
      const outerW = outer.clientWidth || 0;
      const naturalH = inner.scrollHeight || inner.offsetHeight || 0;
      setDims((prev) =>
        prev.outerW === outerW && prev.naturalH === naturalH
          ? prev
          : { outerW, naturalH }
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [el.widthOverride, el.heightOverride, el]);

  // Compute scale factors relative to the baseline. The inner box is laid out
  // at a fixed baseline width; the horizontal scale is outerW / baselineW. If
  // the user set a heightOverride, scale vertically so the content fills it;
  // otherwise scale Y to match X (uniform / proportional growth).
  const widthPct = el.widthOverride ?? BASELINE_WIDTH_PCT;
  const baselineWidthPx = dims.outerW > 0
    ? (dims.outerW * BASELINE_WIDTH_PCT) / Math.max(1, widthPct)
    : 0;
  const sx = baselineWidthPx > 0 ? dims.outerW / baselineWidthPx : 1;
  const desiredH = el.heightOverride;
  const sy = desiredH && dims.naturalH > 0
    ? Math.max(desiredH / dims.naturalH, sx)
    : sx;
  const containerH = dims.naturalH > 0 ? dims.naturalH * sy : null;

  return (
    <div
      ref={outerRef}
      style={{
        width: "100%",
        height: containerH != null ? containerH + "px" : "auto",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        ref={innerRef}
        style={{
          transform: `scale(${sx}, ${sy})`,
          transformOrigin: "top left",
          width: baselineWidthPx > 0 ? baselineWidthPx + "px" : "100%",
        }}
      >
        {children}
      </div>
    </div>
  );
}


function ElView({ el, gv, selected, onClick, onResize, onDelete, onDragStart, onReset, oneLineOnly = true }) {
  // Per-element typography overrides
  const fs        = el.fontSizeOverride || gv.fontSize;
  const elFamily  = (el.fontFamily && el.fontFamily !== "default") ? el.fontFamily : "'Nunito', sans-serif";
  const elWeight  = el.bold ? 800 : undefined;
  const elStyle   = el.italic ? "italic" : undefined;
  const elDecor   = el.underline ? "underline" : undefined;
  const elAlign   = el.textAlign || undefined;

  // Font-size lock: when the user picks a specific text-size preset (or
  // custom pt) we treat that pt value as the FINAL rendered size and do NOT
  // multiply it by the resize scale. Box paddings/spacing still scale with
  // the box so the layout breathes; only the text stays exactly at the
  // chosen size. When no override is set, text scales with the box like
  // before (auto mode).
  const fsLocked = !!el.fontSizeOverride;
  const tScale = (sc) => fsLocked ? 1 : sc.s;

  // Helper: per-item single-line vs wrap styling. Used by list-style elements
  // (Success Criteria, Exit Ticket, DOK Questions). When oneLineOnly is on,
  // each item stays on a single line and clips with ellipsis — encouraging
  // the user to widen the box. When off, items wrap naturally.
  const lineStyle = oneLineOnly
    ? { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }
    : { whiteSpace: "normal", overflow: "visible", wordBreak: "break-word" };

  // The Table element is special: cells must be allowed to wrap so the whole
  // table (headers, rows, cells) actually fits inside the resizable box.
  const isTable = el.type === "table";

  const wrap = {
    position: "absolute",
    left: `${el.x ?? 0}%`,
    top: (el.y ?? 0),
    width: `${el.widthOverride ?? 32}%`,
    cursor: "move",
    outline: selected ? `2px solid ${gv.color}` : "2px solid transparent",
    outlineOffset: 2,
    borderRadius: 8, padding: "6px 6px 14px 6px",
    background: "white",
    transition: "outline 0.1s",
    minHeight: el.heightOverride || undefined,
    height: el.heightOverride || undefined,
    boxSizing: "border-box",
    // Clip ALL inner content to the resizable bounds so nothing renders
    // outside the box on any worksheet element. Tables stay scrollable so
    // every row remains reachable. Resize handles are repositioned to sit
    // flush with the edges (see ResizeHandles below) so clipping does not
    // hide them.
    overflow: isTable ? "auto" : "hidden",
    touchAction: "none", // allow pointer-drag on touch devices (iPad/phone)
  };

  const handleMouseDown = (e) => { onDragStart && onDragStart(e, el.id); };

  // ── Delete button — top-right, visible on hover or when selected ──
  const DeleteBtn = () => (
    <button
      data-delete-btn
      className="el-delete-btn"
      onPointerDown={e => e.stopPropagation()}
      onClick={e => { e.stopPropagation(); onDelete && onDelete(el.id); }}
      aria-label="Delete element"
      title="Delete element"
      style={{
        position: "absolute", top: 4, right: 4,
        width: 22, height: 22, borderRadius: "50%",
        border: "none",
        background: "#DC2626",
        color: "white",
        fontSize: 11, fontWeight: 900, lineHeight: 1,
        cursor: "pointer", zIndex: 20,
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        opacity: selected ? 1 : 0,
      }}
    >✕</button>
  );

  // ── Reset/refresh button — top-LEFT corner. Clears any resize overrides
  // (width, height, axis) so the element snaps back to its default size and
  // proportional content. Useful if a resize ever leaves an element looking
  // off. Visible whenever the element is selected.
  const ResetBtn = () => (
    <button
      data-reset-btn
      className="el-reset-btn"
      onPointerDown={e => e.stopPropagation()}
      onClick={e => {
        e.stopPropagation();
        if (onReset) onReset(el.id);
      }}
      aria-label="Reset element size"
      title="Reset element size"
      style={{
        position: "absolute", top: 4, left: 4,
        width: 22, height: 22, borderRadius: "50%",
        border: "none",
        background: gv.color,
        color: "white",
        fontSize: 13, fontWeight: 900, lineHeight: 1,
        cursor: "pointer", zIndex: 20,
        display: selected ? "flex" : "none",
        alignItems: "center", justifyContent: "center",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
      }}
    >↻</button>
  );
  const ResizeHandles = () => !selected ? null : (
    <>
      {/* Bottom — vertical resize */}
      <div data-resize-handle onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onResize && onResize(e, el.id, "bottom"); }}
        title="Drag to resize height"
        style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:56, height:14, cursor:"ns-resize", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}>
        <div style={{ width:44, height:6, borderRadius:3, background:gv.color, boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
      {/* Top — vertical resize */}
      <div data-resize-handle onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onResize && onResize(e, el.id, "top"); }}
        title="Drag to resize height"
        style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:56, height:14, cursor:"ns-resize", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}>
        <div style={{ width:44, height:6, borderRadius:3, background:gv.color, boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
      {/* Right — horizontal resize (drag this edge to make the box WIDER) */}
      <div data-resize-handle onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onResize && onResize(e, el.id, "right"); }}
        title="Drag to resize width"
        style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", width:14, height:56, cursor:"ew-resize", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}>
        <div style={{ width:6, height:44, borderRadius:3, background:gv.color, boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
      {/* Left — horizontal resize (drag this edge to make the box WIDER) */}
      <div data-resize-handle onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onResize && onResize(e, el.id, "left"); }}
        title="Drag to resize width"
        style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:14, height:56, cursor:"ew-resize", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}>
        <div style={{ width:6, height:44, borderRadius:3, background:gv.color, boxShadow:"0 1px 3px rgba(0,0,0,0.2)" }} />
      </div>
      {/* Bottom-right corner */}
      <div data-resize-handle onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onResize && onResize(e, el.id, "corner"); }}
        style={{ position:"absolute", bottom:0, right:0, width:22, height:22, cursor:"nwse-resize", zIndex:11, touchAction:"none" }}>
        <svg width="12" height="12" viewBox="0 0 12 12" style={{ position:"absolute", bottom:5, right:5 }}>
          <path d="M2,10 L10,2 M6,10 L10,6 M10,10 L10,10" stroke={gv.color} strokeWidth="2" strokeLinecap="round"/>
        </svg>
      </div>
    </>
  );

  if (el.type === "instruction") {
    const sc = resizeScaleFor(el);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Instructions element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        <div style={{ fontSize: Math.max(fs - 6, 12) * tScale(sc), fontWeight: elWeight || 600, color: "#1F2937", background: "#FEFCE8", padding: `${10 * sc.s}px ${16 * sc.s}px`, borderRadius: 8, borderLeft: `${5 * sc.s}px solid ${gv.color}`, fontFamily: elFamily, lineHeight: 1.6, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{renderInlineMarkdown(el.text)}</div>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "text") {
    const sc = resizeScaleFor(el);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Text block — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        <p style={{ fontSize: fs * tScale(sc), fontWeight: elWeight || 500, color: "#111827", margin: 0, fontFamily: elFamily, lineHeight: 1.75, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{renderInlineMarkdown(el.text)}</p>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "image") {
    const isSmall = el.size === "small";
    const isLarge = el.size === "large";
    const floated = isSmall && (el.align === "left" || el.align === "right");
    // If user has manually resized the wrapper, let the image fill it on BOTH
    // axes (fixes "image only resizes from one plane"). Otherwise fall back to
    // the size-preset caps.
    const userSized = !!(el.widthOverride || el.heightOverride);
    const imgMaxW = isSmall ? "32%" : isLarge ? "94%" : "62%";
    const floatStyle = floated ? { float: el.align, marginRight: el.align === "left" ? 18 : 0, marginLeft: el.align === "right" ? 18 : 0, marginBottom: 10, width: "32%" } : {};
    const resizedInlineImage = userSized && !floated;
    const containerStyle = floated
      ? { ...wrap, overflow: "hidden" }
      : {
          ...wrap,
          textAlign: el.align || "center",
          ...(resizedInlineImage ? { display: "flex", flexDirection: "column", alignItems: "stretch" } : {}),
        };
    const imageFrameStyle = resizedInlineImage
      ? { width: "100%", flex: el.heightOverride ? "1 1 auto" : "0 0 auto", minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }
      : undefined;
    // When the user resizes the wrapper, the image must scale proportionally
    // with the box on BOTH axes and never get cut off. width:100% + height:100%
    // (when a heightOverride exists) + object-fit:contain guarantees the image
    // always fits inside the resized box, preserves aspect ratio, and shrinks
    // when the box shrinks — no clipping, no letterbox-pinned pixel height.
    const fillImgStyle = resizedInlineImage
      ? { width: "100%", height: el.heightOverride ? "100%" : "auto", maxWidth: "100%", maxHeight: "100%", objectFit: "contain", display: "block", boxSizing: "border-box", borderRadius: 8, border: "1.5px solid #E5E7EB" }
      : { ...floatStyle, ...(!floated ? { maxWidth: imgMaxW } : {}), borderRadius: 8, border: "1.5px solid #E5E7EB", maxHeight: floated ? 200 : 360, objectFit: "contain", display: floated ? "block" : "inline-block" };
    return (
      <div className="ws-element" style={containerStyle} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Image element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        {el.url && resizedInlineImage ? (
          <div style={imageFrameStyle}>
            <img src={el.url} alt={el.caption || "Worksheet illustration"} style={fillImgStyle} />
          </div>
        ) : el.url ? (
          <img src={el.url} alt={el.caption || "Worksheet illustration"} style={fillImgStyle} />
        ) : (
          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: isSmall ? 150 : isLarge ? 400 : 260, height: isSmall ? 110 : isLarge ? 290 : 190, border: `2px dashed ${gv.color}50`, borderRadius: 10, background: gv.light, gap: 8, ...floatStyle }}>
            <span style={{ fontSize: 34 }} aria-hidden="true">🖼️</span>
            <span style={{ fontSize: 11, color: "#9CA3AF", fontFamily: F, fontWeight: 600 }}>Click to add image</span>
          </div>
        )}
        {floated && (
          <div style={{ fontSize: fs, fontFamily: elFamily, lineHeight: gv.lineH + "px", minHeight: 110 }}>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} style={{ borderBottom: "1.5px dashed #D1D5DB", height: gv.lineH, marginBottom: 4 }} />
            ))}
          </div>
        )}
        {!floated && el.caption && <p style={{ fontSize: Math.max(fs - 10, 11), color: "#6B7280", textAlign: "center", margin: "6px 0 0", fontFamily: F, fontWeight: 600, flex: resizedInlineImage ? "0 0 auto" : undefined, maxWidth: resizedInlineImage ? "100%" : undefined }}>{el.caption}</p>}
        {floated && <div style={{ clear: "both" }} />}
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "blank") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Write lines element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      {el.label && <p style={{ fontSize: Math.max(fs - 3, 12), fontWeight: elWeight || 700, color: "#111827", margin: "0 0 10px 0", fontFamily: elFamily, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{el.label}</p>}
      {Array.from({ length: el.lines || 3 }).map((_, i) => <div key={i} aria-hidden="true" style={{ height: gv.lineH, borderBottom: "2px solid #D1D5DB", marginBottom: 6 }} />)}
      <DeleteBtn /><ResetBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "wordBank") {
    const scale = resizeScaleFor(el);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Word bank element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        <p style={{ fontSize: Math.max(fs - 4, 12) * tScale(scale), fontWeight: 700, color: gv.color, margin: "0 0 10px 0", fontFamily: FF, letterSpacing: 0.3 }}>{el.title}</p>
        <div style={{ display: "flex", flexWrap: "wrap", alignContent: "flex-start", gap: 8 * scale.s, padding: `${10 * scale.s}px ${14 * scale.s}px`, background: gv.light, borderRadius: 8, border: `1.5px solid ${gv.color}25`, minHeight: el.heightOverride ? Math.max(24, el.heightOverride - 46) : undefined, boxSizing: "border-box" }}>
          {(el.words || []).map((w, i) => <span key={i} style={{ fontSize: fs * tScale(scale), fontWeight: 600, fontFamily: elFamily, padding: `${4 * scale.s}px ${14 * scale.s}px`, border: `1.5px solid ${gv.color}`, borderRadius: 40, background: "white", color: "#111827", lineHeight: 1.35 }}>{w}</span>)}
        </div>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "matching") {
    const sc = resizeScaleFor(el);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Matching activity — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        {el.title && <p style={{ fontSize: Math.max(fs - 3, 12) * tScale(sc), fontWeight: elWeight || 700, color: "#111827", margin: `0 0 ${12 * sc.s}px 0`, fontFamily: elFamily }}>{el.title}</p>}
        <div style={{ display: "grid", gridTemplateColumns: `1fr ${40 * sc.s}px 1fr`, gap: 6 * sc.s, alignItems: "center" }}>
          {(el.left || []).map((item, i) => (
            <span key={i} style={{ display: "contents" }}>
              <div style={{ fontSize: fs * tScale(sc), fontWeight: 600, fontFamily: elFamily, padding: `${6 * sc.s}px ${10 * sc.s}px`, border: `1.5px solid ${gv.color}`, borderRadius: 8, background: gv.light, textAlign: "center" }}>{renderInlineMarkdown(item)}</div>
              <div aria-hidden="true" style={{ borderBottom: "1.5px dashed #9CA3AF", margin: `0 ${4 * sc.s}px` }} />
              <div style={{ fontSize: fs * tScale(sc), fontWeight: 600, fontFamily: elFamily, padding: `${6 * sc.s}px ${10 * sc.s}px`, border: `1.5px solid ${gv.color}`, borderRadius: 8, background: gv.light, textAlign: "center" }}>{renderInlineMarkdown((el.right || [])[i] || "")}</div>
            </span>
          ))}
        </div>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "multipleChoice") {
    const sc = resizeScaleFor(el);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Multiple choice question — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        <p style={{ fontSize: fs * tScale(sc), fontWeight: elWeight || 700, color: "#111827", margin: `0 0 ${5 * sc.s}px 0`, fontFamily: elFamily, lineHeight: 1.45, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{renderInlineMarkdown(el.question)}</p>
        {el.note && <p style={{ fontSize: Math.max(fs - 7, 11) * tScale(sc), fontWeight: 500, color: "#6B7280", margin: `0 0 ${12 * sc.s}px 0`, fontFamily: F }}>{el.note}</p>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 * sc.s }}>
          {(el.choices || []).map((c, i) => (
            <label key={i} style={{ display: "flex", alignItems: "center", gap: 8 * sc.s }}>
              <div aria-hidden="true" style={{ width: Math.min(22, fs) * sc.s, height: Math.min(22, fs) * sc.s, borderRadius: "50%", border: `2px solid ${gv.color}`, flexShrink: 0, background: "white" }} />
              <span style={{ fontSize: fs * tScale(sc), fontWeight: 500, fontFamily: elFamily }}>{renderInlineMarkdown(c)}</span>
            </label>
          ))}
        </div>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "truefalse") {
    const scale = resizeScaleFor(el);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="True or false activity — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        <p style={{ fontSize: Math.max(fs - 4, 12) * tScale(scale), fontWeight: 700, color: gv.color, margin: "0 0 10px 0", fontFamily: FF }}>True or False? Circle your answer.</p>
        {(el.statements || []).map((stmt, i) => (
          <div key={i} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 10 * scale.s, rowGap: 6 * scale.s, marginBottom: 10 * scale.s, padding: `${8 * scale.s}px ${12 * scale.s}px`, background: gv.light, borderRadius: 8, minHeight: el.heightOverride ? Math.max(34, (el.heightOverride - 42) / Math.max(1, (el.statements || []).length)) : undefined, boxSizing: "border-box" }}>
            <span style={{ fontSize: fs * tScale(scale), fontWeight: 500, fontFamily: elFamily, flex: "1 1 70%", minWidth: 0, lineHeight: 1.45, wordBreak: "break-word" }}>{renderInlineMarkdown(stmt)}</span>
            <div style={{ display: "flex", gap: 6 * scale.s, flexShrink: 0, marginLeft: "auto" }}>
              {["TRUE", "FALSE"].map(t => <span key={t} style={{ fontSize: Math.max(fs - 6, 10) * tScale(scale), fontWeight: 700, padding: `${3 * scale.s}px ${10 * scale.s}px`, border: `1.5px solid ${gv.color}`, borderRadius: 40, fontFamily: F, color: gv.color, textAlign: "center", whiteSpace: "nowrap" }}>{t}</span>)}
            </div>
          </div>
        ))}
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "shortAnswer") {
    const sc = resizeScaleFor(el);
    // Grow the answer-line count to fill the wrapper height when the user
    // resizes vertically, so the box never has empty space below the lines.
    const lineUnit = (gv.lineH * 0.9 * sc.s) + 5;
    const reserved = 48 * sc.s;
    const fitLines = el.heightOverride
      ? Math.max(el.lines || 4, Math.floor((el.heightOverride - reserved) / Math.max(8, lineUnit)))
      : (el.lines || 4);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Short answer question — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        <p style={{ fontSize: fs * tScale(sc), fontWeight: elWeight || 700, color: "#111827", margin: `0 0 ${12 * sc.s}px 0`, fontFamily: elFamily, lineHeight: 1.45, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign, ...lineStyle }}>{renderInlineMarkdown(el.question)}</p>
        {Array.from({ length: fitLines }).map((_, i) => <div key={i} aria-hidden="true" style={{ height: gv.lineH * 0.9 * sc.s, borderBottom: "1.5px solid #D1D5DB", marginBottom: 5 * sc.s }} />)}
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "fillBlank") {
    const sc = resizeScaleFor(el);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Fill in the blank activity — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        {el.note && <p style={{ fontSize: Math.max(fs - 7, 11) * tScale(sc), fontWeight: 500, color: "#6B7280", margin: `0 0 ${8 * sc.s}px 0`, fontFamily: F }}>{el.note}</p>}
        <p style={{ fontSize: fs * tScale(sc), fontWeight: elWeight || 500, color: "#111827", margin: 0, fontFamily: elFamily, lineHeight: 1.9, fontStyle: elStyle, textAlign: elAlign, wordBreak: "break-word", overflowWrap: "anywhere", maxWidth: "100%" }}>
          {(el.text || "").split("______").map((part, i, arr) => (
            <span key={i}>{renderInlineMarkdown(part)}{i < arr.length - 1 && <span aria-label="blank" style={{ display: "inline-block", width: Math.min(85, 60) * sc.s, borderBottom: `2px solid ${gv.color}`, verticalAlign: "bottom", margin: `0 ${3 * sc.s}px` }} />}</span>
          ))}
        </p>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "essay") {
    const sc = resizeScaleFor(el);
    // When the user resizes the box vertically, grow the writing-line count to
    // fill the new height. Each ruled line is roughly gv.lineH * 0.75 px tall
    // (matches the renderer below) plus a 3px gap. We reserve ~64px for the
    // prompt + points header so the lines actually sit underneath it.
    const lineUnit = (gv.lineH * 0.75 * sc.s) + 3;
    const reserved = 64 * sc.s;
    const fitLines = el.heightOverride
      ? Math.max(el.lines || 14, Math.floor((el.heightOverride - reserved) / Math.max(8, lineUnit)))
      : (el.lines || 14);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Essay prompt — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 * sc.s }}>
          <p style={{ fontSize: fs * tScale(sc), fontWeight: elWeight || 700, color: "#111827", margin: 0, fontFamily: elFamily, lineHeight: 1.45, flex: 1, minWidth: 0, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign, ...lineStyle }}>{renderInlineMarkdown(el.prompt)}</p>
          {el.points && <span style={{ fontSize: Math.max(fs - 6, 10) * tScale(sc), fontWeight: 700, color: gv.color, whiteSpace: "nowrap", marginLeft: 12 * sc.s, fontFamily: F, padding: `${3 * sc.s}px ${9 * sc.s}px`, border: `1.5px solid ${gv.color}`, borderRadius: 40 }}>{el.points} pts</span>}
        </div>
        {Array.from({ length: fitLines }).map((_, i) => <div key={i} aria-hidden="true" style={{ height: gv.lineH * 0.75 * sc.s, borderBottom: "1px solid #E5E7EB", marginBottom: 3 * sc.s }} />)}
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "successCriteria" || el.type === "exitTicket") {
    const accent = el.type === "successCriteria" ? gv.color : "#0369A1";
    const bg = el.type === "successCriteria" ? gv.light : "#EFF6FF";
    const sc = resizeScaleFor(el);
    // Line spacing must stay CONSTANT regardless of box height — vertical
    // resizing should never add gaps between items. Items always pack from
    // the top with a fixed gap that only scales with width (sc.s tracks width).
    const itemGap = 8 * sc.s;
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="group" tabIndex={0} aria-label={`${el.type === "successCriteria" ? "Success criteria" : "Exit ticket"} — click to edit`} onKeyDown={e => e.key === "Enter" && onClick()}>
        <div style={{ background: bg, border: `2px solid ${accent}45`, borderLeft: `${6 * sc.s}px solid ${accent}`, borderRadius: 10, padding: `${12 * sc.s}px ${16 * sc.s}px`, height: el.heightOverride ? "100%" : undefined, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
          {el.title && <p style={{ fontSize: Math.max(fs - 2, 13) * tScale(sc), fontWeight: 800, color: accent, margin: `0 0 ${6 * sc.s}px 0`, fontFamily: FF, letterSpacing: 0.2 }}>{el.title}</p>}
          {el.intro && <p style={{ fontSize: Math.max(fs - 4, 11) * tScale(sc), fontWeight: 600, color: "#374151", margin: `0 0 ${10 * sc.s}px 0`, fontFamily: F, lineHeight: 1.5 }}>{renderInlineMarkdown(el.intro)}</p>}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: itemGap, justifyContent: "flex-start" }}>
            {(el.items || []).map((item, i) => (
              <li key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 * sc.s }}>
                <span aria-hidden="true" style={{ flexShrink: 0, width: 18 * sc.s, height: 18 * sc.s, marginTop: 2 * sc.s, border: `2px solid ${accent}`, borderRadius: 4, background: "white" }} />
                <span style={{ fontSize: fs * tScale(sc), fontWeight: elWeight || 600, color: "#111827", fontFamily: elFamily, lineHeight: 1.45, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign, flex: 1, minWidth: 0, ...lineStyle }}>{renderInlineMarkdown(item)}</span>
              </li>
            ))}
          </ul>
        </div>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "dokQuestions") {
    const LEVEL_COLORS = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"];
    const sc = resizeScaleFor(el);
    // DOK cards contain multiple nested text boxes. Tie their internal scale to
    // width only and cap it so vertical resizing does not balloon type/gaps and
    // push most questions out of view.
    const dokS = Math.max(SCALE_MIN, Math.min(1.35, sc.sx));
    const dokTextScale = fsLocked ? 1 : dokS;
    const levelGap = 10;
    const itemGap = 6;
    const dokLineStyle = { whiteSpace: "normal", overflow: "visible", wordBreak: "break-word" };
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="group" tabIndex={0} aria-label="DOK Questions — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        <div style={{ background: "#FFFFFF", border: `2px solid ${gv.color}45`, borderLeft: `${6 * dokS}px solid ${gv.color}`, borderRadius: 10, padding: `${12 * dokS}px ${16 * dokS}px`, height: el.heightOverride ? "100%" : undefined, boxSizing: "border-box", display: "flex", flexDirection: "column", overflowY: el.heightOverride ? "auto" : "visible", minHeight: 0 }}>
          {el.title && <p style={{ fontSize: Math.max(fs - 2, 13) * dokTextScale, fontWeight: 800, color: gv.color, margin: `0 0 ${6 * dokS}px 0`, fontFamily: FF, letterSpacing: 0.2 }}>{el.title}</p>}
          {el.intro && <p style={{ fontSize: Math.max(fs - 4, 11) * dokTextScale, fontWeight: 600, color: "#374151", margin: `0 0 ${10 * dokS}px 0`, fontFamily: F, lineHeight: 1.45, ...dokLineStyle }}>{renderInlineMarkdown(el.intro)}</p>}
          <div style={{ display: "flex", flexDirection: "column", gap: levelGap, flex: 1, justifyContent: "flex-start", minHeight: 0 }}>
            {(el.levels || []).map((lv, li) => {
              const c = LEVEL_COLORS[(lv.level || li + 1) - 1] || gv.color;
              return (
                <div key={li} style={{ background: c + "10", border: `1.5px solid ${c}55`, borderRadius: 8, padding: `${8 * dokS}px ${10 * dokS}px` }}>
                  <p style={{ fontSize: Math.max(fs - 4, 11) * dokTextScale, fontWeight: 800, color: c, margin: `0 0 ${6 * dokS}px 0`, fontFamily: FF }}>
                    DOK {lv.level} · {lv.label}
                  </p>
                  <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: itemGap }}>
                    {(lv.items || []).map((q, qi) => (
                      <li key={qi} style={{ display: "flex", alignItems: "flex-start", gap: 8 * dokS }}>
                        <span aria-hidden="true" style={{ flexShrink: 0, width: 16 * dokS, height: 16 * dokS, marginTop: 2 * dokS, border: `2px solid ${c}`, borderRadius: 3, background: "white" }} />
                        <span style={{ fontSize: Math.max(fs - 1, 12) * dokTextScale, fontWeight: elWeight || 600, color: "#111827", fontFamily: elFamily, lineHeight: 1.45, flex: 1, minWidth: 0, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign, ...dokLineStyle }}>{renderInlineMarkdown(q)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "table") {
    const sc = resizeScaleFor(el);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Table element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        {el.title && <p style={{ fontSize: Math.max(fs - 3, 12) * tScale(sc), fontWeight: elWeight || 700, color: "#111827", margin: `0 0 ${8 * sc.s}px 0`, fontFamily: elFamily }}>{el.title}</p>}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: Math.max(fs - 4, 11) * tScale(sc), fontFamily: elFamily }} role="table">
          <thead>
            <tr>{(el.headers || []).map((h, i) => <th key={i} scope="col" style={{ padding: `${7 * sc.s}px ${10 * sc.s}px`, border: `1.5px solid ${gv.color}`, background: gv.color, color: "white", fontWeight: 700, textAlign: "center", fontFamily: F }}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {(el.rows || []).map((row, ri) => (
              <tr key={ri}>{(row || []).map((cell, ci) => <td key={ci} style={{ padding: `${5 * sc.s}px ${9 * sc.s}px`, border: "1px solid #D1D5DB", height: gv.lineH * sc.s, verticalAlign: "top" }}>{cell || " "}</td>)}</tr>
            ))}
          </tbody>
        </table>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "divider") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="separator" tabIndex={0} aria-label="Section divider" onKeyDown={e => e.key === "Enter" && onClick()}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "4px 0" }}>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to right, transparent, ${gv.color}35)` }} />
        <span aria-hidden="true" style={{ fontSize: 14, color: gv.color + "80" }}>✦</span>
        <div style={{ flex: 1, height: 1, background: `linear-gradient(to left, transparent, ${gv.color}35)` }} />
      </div>
    </div>
  );

  if (el.type === "customShape") {
    const shapes = el.shapes || [];
    const colMap = { "1-col":1, "2-col":2, "3-col":3, "4-col":4, "2x2":2 };
    const requestedCols = colMap[el.layout] || 2;
    const orientation = el.orientation || "horizontal"; // "horizontal" | "vertical"
    // Vertical = stack in a single column (one shape per row).
    const cols = orientation === "vertical" ? 1 : requestedCols;
    const fs = el.fontSizeOverride || gv.fontSize;
    // When the user resizes the customShape wrapper, scale shapes proportionally
    // to fill the new width and height (fixes "shapes don't resize").
    const userSized = !!(el.widthOverride || el.heightOverride);
    return (
      <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Custom shapes element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        {el.title && <p style={{ fontSize: Math.max(fs - 1, 12), fontWeight: 700, color: "#111827", margin: "0 0 12px 0", fontFamily: (el.fontFamily && el.fontFamily !== "default") ? el.fontFamily : "'Inter',sans-serif" }}>{el.title}</p>}
        <div style={{ display:"grid", gridTemplateColumns:`repeat(${cols}, 1fr)`, gap:16, alignItems:"start" }}>
          {shapes.map((s, i) => {
            // If user-sized, ignore fixed s.width and let the SVG scale to its
            // grid cell. Height scales proportionally based on cell count.
            const shapeW = userSized ? "100%" : s.width;
            const baseRowH = el.heightOverride
              ? Math.max(80, (el.heightOverride - 60) / Math.max(1, Math.ceil(shapes.length / cols)))
              : null;
            const shapeH = userSized && baseRowH ? Math.round(baseRowH) : s.height;
            return (
              <div key={i} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:6, width:"100%" }}>
                <div style={{ width:"100%", display:"flex", justifyContent:"center" }}>
                  <ShapeSVG
                    shape={s.shape} fill={s.fill} border={s.border} borderWidth={s.borderWidth}
                    width={shapeW} height={shapeH} label={s.label} lines={s.lines} fontSize={fs}
                  />
                </div>
                {s.caption && <span style={{ fontSize: Math.max(fs-3,10), color:"#6B7280", fontFamily:F, fontWeight:600, textAlign:"center" }}>{s.caption}</span>}
              </div>
            );
          })}
        </div>
        <DeleteBtn /><ResetBtn /><ResizeHandles />
      </div>
    );
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ELEMENT EDITOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ElEditor({ el, gv, onChange, onDelete, onMoveUp, onMoveDown, onDuplicate }) {
  const inp = { ...INP(), marginTop: 4 };
  if (!el) return (
    <div style={{ padding: 32, textAlign: "center", fontFamily: F, animation: "fadeIn 0.3s ease" }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 24 }}>✏️</div>
      <p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.6, color: "#9CA3AF", margin: 0 }}>Select any element on the worksheet to edit its content and appearance here.</p>
    </div>
  );

  const paletteItem = PALETTE.find(p => p.type === el.type);

  // Preset text-size buttons. These map to absolute pt values that work well
  // across all worksheet element types and stay readable when boxes are
  // resized. Selecting a preset writes el.fontSizeOverride; the numeric input
  // below remains available for fine-tuning. "Default" clears the override
  // and falls back to the grade-band default (gv.fontSize).
  const SIZE_PRESETS = [
    { key: "xs",      label: "XS",      pt: 10 },
    { key: "s",       label: "S",       pt: 12 },
    { key: "m",       label: "M",       pt: 14 },
    { key: "l",       label: "L",       pt: 18 },
    { key: "xl",      label: "XL",      pt: 22 },
    { key: "xxl",     label: "XXL",     pt: 28 },
  ];
  const activeSizePt = el.fontSizeOverride || null;

  // ── Typography section (shared by ALL worksheet element types) ──
  // Lock vs Auto toggle:
  //   • Lock  → fontSizeOverride is set (current preset, custom value, or
  //             the grade-default snapshot). Resizing the box will NOT change
  //             the rendered text size.
  //   • Auto  → fontSizeOverride is null. Text scales with the box.
  const isLocked = activeSizePt !== null;
  const TypographySection = () => (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
      <p style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 10px 0" }}>Typography</p>

      <label style={LBL}>Font Size Scaling</label>
      <div role="group" aria-label="Font size scaling mode" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 4, marginBottom: 10 }}>
        <button
          onClick={() => onChange({ fontSizeOverride: null })}
          aria-label="Auto — text scales when the box is resized"
          aria-pressed={!isLocked}
          title="Auto — text scales when the box is resized"
          style={{ padding: "8px 0", borderRadius: 7, border: `1.5px solid ${!isLocked ? gv.color : "#E5E7EB"}`, background: !isLocked ? gv.light : "white", fontFamily: F, fontSize: 12, fontWeight: 800, cursor: "pointer", color: !isLocked ? gv.color : "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        ><span aria-hidden="true">↔</span> Auto-scale</button>
        <button
          onClick={() => onChange({ fontSizeOverride: el.fontSizeOverride || gv.fontSize })}
          aria-label="Lock — keep text size fixed when the box is resized"
          aria-pressed={isLocked}
          title="Lock — text stays the same size when the box is resized"
          style={{ padding: "8px 0", borderRadius: 7, border: `1.5px solid ${isLocked ? gv.color : "#E5E7EB"}`, background: isLocked ? gv.light : "white", fontFamily: F, fontSize: 12, fontWeight: 800, cursor: "pointer", color: isLocked ? gv.color : "#374151", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
        ><span aria-hidden="true">🔒</span> Lock size{isLocked ? ` (${activeSizePt}pt)` : ""}</button>
      </div>

      <label style={LBL}>Text Size</label>
      <div role="group" aria-label="Text size preset" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginTop: 4 }}>
        <button
          key="default"
          onClick={() => onChange({ fontSizeOverride: null })}
          aria-label="Use grade-default text size"
          aria-pressed={activeSizePt === null}
          title={`Default (${gv.fontSize}pt)`}
          style={{ padding: "6px 0", borderRadius: 6, border: `1.5px solid ${activeSizePt === null ? gv.color : "#E5E7EB"}`, background: activeSizePt === null ? gv.light : "white", fontFamily: F, fontSize: 11, fontWeight: 700, cursor: "pointer", color: activeSizePt === null ? gv.color : "#374151" }}
        >Auto</button>
        {SIZE_PRESETS.map(p => {
          const sel = activeSizePt === p.pt;
          return (
            <button key={p.key}
              onClick={() => onChange({ fontSizeOverride: p.pt })}
              aria-label={`Set text size ${p.label} (${p.pt}pt)`}
              aria-pressed={sel}
              title={`${p.label} — ${p.pt}pt`}
              style={{ padding: "6px 0", borderRadius: 6, border: `1.5px solid ${sel ? gv.color : "#E5E7EB"}`, background: sel ? gv.light : "white", fontFamily: F, fontSize: 11, fontWeight: 700, cursor: "pointer", color: sel ? gv.color : "#374151" }}
            >{p.label}</button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        <div>
          <label style={LBL}>Custom (pt)</label>
          <input type="number" min={8} max={72} value={el.fontSizeOverride || ""} placeholder={`${gv.fontSize}`}
            onChange={e => onChange({ fontSizeOverride: e.target.value ? parseInt(e.target.value) : null })}
            style={{ ...inp, marginTop: 4 }} aria-label="Custom font size in points" />
        </div>
        <div>
          <label style={LBL}>Text Align</label>
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            {[["left","←"],["center","≡"],["right","→"]].map(([a, lbl]) => (
              <button key={a} onClick={() => onChange({ textAlign: a })} aria-label={`Align ${a}`} aria-pressed={(el.textAlign||"left")===a}
                style={{ flex: 1, padding: "6px 0", borderRadius: 6, border: `1.5px solid ${(el.textAlign||"left")===a ? gv.color : "#E5E7EB"}`, background: (el.textAlign||"left")===a ? gv.light : "white", fontSize: 14, cursor: "pointer", color: (el.textAlign||"left")===a ? gv.color : "#6B7280" }}>{lbl}</button>
            ))}
          </div>
        </div>
      </div>

      <label style={LBL}>Font Family</label>
      <select value={el.fontFamily || "default"} onChange={e => onChange({ fontFamily: e.target.value })} style={inp} aria-label="Font family">
        {WORKSHEET_FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>

      <label style={LBL}>Style</label>
      <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
        {[["bold","B","Bold"],["italic","I","Italic"],["underline","U","Underline"]].map(([k, lbl, aria]) => (
          <button key={k} onClick={() => onChange({ [k]: !el[k] })} aria-label={aria} aria-pressed={!!el[k]}
            style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: `1.5px solid ${el[k] ? gv.color : "#E5E7EB"}`, background: el[k] ? gv.light : "white", fontFamily: k === "italic" ? "Georgia, serif" : F, fontWeight: k === "bold" ? 800 : 600, fontStyle: k === "italic" ? "italic" : "normal", textDecoration: k === "underline" ? "underline" : "none", fontSize: 13, cursor: "pointer", color: el[k] ? gv.color : "#374151" }}>{lbl}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "14px 16px", overflowY: "auto", flex: 1 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span style={{ fontFamily: F, fontWeight: 700, color: gv.color, fontSize: 13 }}>
          {paletteItem?.emoji} {paletteItem?.label || "Element"}
        </span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onMoveUp}   aria-label="Move element up"   style={{ padding: "4px 9px", borderRadius: 6, border: "1.5px solid #E5E7EB", background: "white", cursor: "pointer", fontFamily: F, fontSize: 13, color: "#374151" }}>↑</button>
          <button onClick={onMoveDown} aria-label="Move element down" style={{ padding: "4px 9px", borderRadius: 6, border: "1.5px solid #E5E7EB", background: "white", cursor: "pointer", fontFamily: F, fontSize: 13, color: "#374151" }}>↓</button>
          <button onClick={onDuplicate} aria-label="Duplicate element" title="Duplicate (Ctrl/Cmd+D)" style={{ padding: "4px 9px", borderRadius: 6, border: "1.5px solid #BFDBFE", background: "#EFF6FF", cursor: "pointer", fontFamily: F, fontSize: 13, color: "#1D4ED8" }}>⧉ Duplicate</button>
          <button onClick={onDelete}   aria-label="Delete element"    style={{ padding: "4px 9px", borderRadius: 6, border: "1.5px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", fontFamily: F, fontSize: 13, color: "#DC2626" }}>Delete</button>
        </div>
      </div>

      {(el.type === "instruction" || el.type === "text") && (<>
        <label style={LBL}>Content</label>
        <SpellTextarea value={el.text} spellCheck onChange={e => onChange({ text: e.target.value })} style={{ ...inp, minHeight: 90, marginTop: 4 }} aria-label="Text content" />
        <TypographySection />
      </>)}

      {el.type === "image" && (<>
        <label style={LBL}>Image URL</label>
        <input type="url" value={el.url || ""} onChange={e => onChange({ url: e.target.value })} placeholder="https://…" style={{ ...inp, marginTop: 4 }} aria-label="Image URL" />
        <label style={LBL}>Upload from Device</label>
        <input type="file" accept="image/*" aria-label="Upload image file" onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => onChange({ url: ev.target.result }); r.readAsDataURL(f); } }} style={{ ...inp, padding: 6, cursor: "pointer", marginTop: 4 }} />
        <label style={LBL}>Caption</label>
        <SpellInput type="text" value={el.caption || ""} spellCheck onChange={e => onChange({ caption: e.target.value })} placeholder="Optional caption…" style={{ ...inp, marginTop: 4 }} aria-label="Image caption" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
          <div>
            <label style={LBL}>Size</label>
            <select value={el.size || "medium"} onChange={e => onChange({ size: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Image size">
              <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
            </select>
          </div>
          <div>
            <label style={LBL}>Alignment</label>
            <select value={el.align || "center"} onChange={e => onChange({ align: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Image alignment">
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </div>
        </div>
        <TypographySection />
      </>)}

      {el.type === "blank" && (<>
        <label style={LBL}>Label / Question</label>
        <SpellInput type="text" value={el.label || ""} spellCheck onChange={e => onChange({ label: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Write lines label" />
        <label style={LBL}>Number of Lines</label>
        <input type="number" min={1} max={20} value={el.lines || 3} onChange={e => onChange({ lines: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...inp, marginTop: 4 }} aria-label="Number of lines" />
        <TypographySection />
      </>)}

      {el.type === "wordBank" && (<>
        <label style={LBL}>Title</label>
        <SpellInput type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Word bank title" />
        <label style={LBL}>Words (one per line — press Enter for a new word)</label>
        {/* Preserve raw text (including trailing empty lines) so Enter creates a new line.
            Only trim/filter when rendering the worksheet preview. */}
        <SpellTextarea
          value={el._wordsRaw !== undefined ? el._wordsRaw : (el.words || []).join("\n")}
          spellCheck
          onChange={e => {
            const raw = e.target.value;
            const words = raw.split("\n").map(w => w.trim()).filter(Boolean);
            onChange({ _wordsRaw: raw, words });
          }}
          style={{ ...inp, minHeight: 110, marginTop: 4 }}
          aria-label="Word bank words"
          placeholder={"cat\ndog\nfish"}
        />
        <TypographySection />
      </>)}

      {el.type === "matching" && (<>
        <label style={LBL}>Title</label>
        <SpellInput type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Matching title" />
        <label style={LBL}>Left Column (one per line — press Enter for a new item)</label>
        <SpellTextarea
          value={el._leftRaw !== undefined ? el._leftRaw : (el.left || []).join("\n")}
          spellCheck
          onChange={e => { const raw = e.target.value; onChange({ _leftRaw: raw, left: raw.split("\n").map(x => x.trim()).filter(Boolean) }); }}
          style={{ ...inp, minHeight: 80, marginTop: 4 }}
          aria-label="Left column items"
        />
        <label style={LBL}>Right Column (one per line — press Enter for a new item)</label>
        <SpellTextarea
          value={el._rightRaw !== undefined ? el._rightRaw : (el.right || []).join("\n")}
          spellCheck
          onChange={e => { const raw = e.target.value; onChange({ _rightRaw: raw, right: raw.split("\n").map(x => x.trim()).filter(Boolean) }); }}
          style={{ ...inp, minHeight: 80, marginTop: 4 }}
          aria-label="Right column items"
        />
        <TypographySection />
      </>)}

      {el.type === "multipleChoice" && (<>
        <label style={LBL}>Question</label>
        <SpellInput type="text" value={el.question || ""} spellCheck onChange={e => onChange({ question: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Question text" />
        <label style={LBL}>Instruction</label>
        <SpellInput type="text" value={el.note || ""} spellCheck onChange={e => onChange({ note: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Instruction note" />
        <label style={LBL}>Answer Choices (one per line — press Enter for a new choice)</label>
        <SpellTextarea
          value={el._choicesRaw !== undefined ? el._choicesRaw : (el.choices || []).join("\n")}
          spellCheck
          onChange={e => { const raw = e.target.value; onChange({ _choicesRaw: raw, choices: raw.split("\n").map(c => c.trim()).filter(Boolean) }); }}
          style={{ ...inp, minHeight: 90, marginTop: 4 }}
          aria-label="Answer choices"
        />
        <TypographySection />
      </>)}

      {el.type === "truefalse" && (<>
        <label style={LBL}>Statements (one per line — press Enter for a new statement)</label>
        <SpellTextarea
          value={el._statementsRaw !== undefined ? el._statementsRaw : (el.statements || []).join("\n")}
          spellCheck
          onChange={e => { const raw = e.target.value; onChange({ _statementsRaw: raw, statements: raw.split("\n").map(s => s.trim()).filter(Boolean) }); }}
          style={{ ...inp, minHeight: 120, marginTop: 4 }}
          aria-label="True/false statements"
        />
        <TypographySection />
      </>)}

      {el.type === "shortAnswer" && (<>
        <label style={LBL}>Question</label>
        <SpellTextarea value={el.question || ""} spellCheck onChange={e => onChange({ question: e.target.value })} style={{ ...inp, minHeight: 70, marginTop: 4 }} aria-label="Short answer question" />
        <label style={LBL}>Number of Lines</label>
        <input type="number" min={1} max={20} value={el.lines || 4} onChange={e => onChange({ lines: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...inp, marginTop: 4 }} aria-label="Number of answer lines" />
        <TypographySection />
      </>)}

      {el.type === "fillBlank" && (<>
        <label style={LBL}>Text (use <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>______</code> for blanks)</label>
        <SpellTextarea value={el.text || ""} spellCheck onChange={e => onChange({ text: e.target.value })} style={{ ...inp, minHeight: 80, marginTop: 4 }} placeholder="The ___ is blue." aria-label="Fill in the blank text" />
        <label style={LBL}>Hint / Note</label>
        <SpellInput type="text" value={el.note || ""} spellCheck onChange={e => onChange({ note: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Hint note" />
        <TypographySection />
      </>)}

      {el.type === "essay" && (<>
        <label style={LBL}>Essay Prompt</label>
        <SpellTextarea value={el.prompt || ""} spellCheck onChange={e => onChange({ prompt: e.target.value })} style={{ ...inp, minHeight: 90, marginTop: 4 }} aria-label="Essay prompt" />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 4 }}>
          <div>
            <label style={LBL}>Point Value</label>
            <input type="number" min={1} max={100} value={el.points || 10} onChange={e => onChange({ points: parseInt(e.target.value) || 10 })} style={{ ...inp, marginTop: 4 }} aria-label="Point value" />
          </div>
          <div>
            <label style={LBL}>Lines</label>
            <input type="number" min={4} max={40} value={el.lines || 14} onChange={e => onChange({ lines: parseInt(e.target.value) || 14 })} style={{ ...inp, marginTop: 4 }} aria-label="Number of essay lines" />
          </div>
        </div>
        <TypographySection />
      </>)}

      {el.type === "table" && (<>
        <label style={LBL}>Title</label>
        <SpellInput type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Table title" />
        <label style={LBL}>Column Headers (one per line — press Enter for a new column)</label>
        <SpellTextarea
          value={el._headersRaw !== undefined ? el._headersRaw : (el.headers || []).join("\n")}
          spellCheck
          onChange={e => { const raw = e.target.value; onChange({ _headersRaw: raw, headers: raw.split("\n").map(h => h.trim()).filter(Boolean) }); }}
          style={{ ...inp, minHeight: 60, marginTop: 4 }}
          aria-label="Column headers"
        />
        <label style={LBL}>Number of Rows</label>
        <input type="number" min={1} max={20} value={(el.rows || []).length || 3}
          onChange={e => { const n = Math.max(1, parseInt(e.target.value) || 1); const cols = (el.headers || []).length || 3; onChange({ rows: Array.from({ length: n }, (_, i) => el.rows?.[i] || Array(cols).fill("")) }); }} style={{ ...inp, marginTop: 4 }} aria-label="Number of rows" />
        <TypographySection />
      </>)}

      {el.type === "customShape" && (<>
        <CustomShapeEditor el={el} onChange={onChange} gv={gv} inp={inp} />
        <TypographySection />
      </>)}

      {(el.type === "successCriteria" || el.type === "exitTicket") && (<>
        <ChecklistEditor el={el} onChange={onChange} gv={gv} inp={inp} />
        <TypographySection />
      </>)}

      {el.type === "dokQuestions" && (<>
        <DokEditor el={el} onChange={onChange} gv={gv} inp={inp} />
        <TypographySection />
      </>)}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DOK QUESTIONS EDITOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const DOK_LEVEL_DEFS = [
  { level: 1, label: "Recall & Reproduction", desc: "identify, name, point to, tell" },
  { level: 2, label: "Skills & Concepts",     desc: "describe, show, sort, match" },
  { level: 3, label: "Strategic Thinking",    desc: "explain, why, predict, support with evidence" },
  { level: 4, label: "Extended Thinking",     desc: "create, design, compare, act out, tell your own story" },
];

function DokEditor({ el, onChange, gv, inp }) {
  const mode = el.mode || "manual";
  const [topic, setTopic] = useState(el.topic || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  // Levels the AI couldn't generate — triggers a follow-up prompt to the user.
  const [missingLevels, setMissingLevels] = useState<number[]>([]);
  const [clarification, setClarification] = useState("");
  const [aiNotice, setAiNotice] = useState("");

  // Call the AI gateway with a DOK-shaped prompt. `onlyLevels` lets us re-ask
  // for just the levels that came back empty on a prior attempt.
  const callAI = async (promptTopic: string, onlyLevels?: number[], extraContext?: string) => {
    const levelsBlock = (onlyLevels && onlyLevels.length)
      ? `Generate 2–3 student-facing questions for ONLY these DOK levels: ${onlyLevels.join(", ")}. Return objects only for those levels.`
      : `Generate 2–3 student-facing questions for EACH of the 4 DOK levels. EVERY level (1, 2, 3, and 4) MUST have at least 2 non-empty items — do not skip any level.`;
    const sys = `You design Depth of Knowledge (DOK) question sets for K–12 lessons based on Norman Webb's framework. DOK measures the depth of cognitive complexity, NOT difficulty.
- Level 1 (Recall & Reproduction): recall facts, terms, simple routine procedures (identify, name, point to, tell).
- Level 2 (Skills & Concepts): apply skills/concepts in specific contexts (describe, show, sort, match, basic inferences).
- Level 3 (Strategic Thinking): reasoning, planning, using evidence to support conclusions in non-routine problems (explain, why, predict, justify).
- Level 4 (Extended Thinking): complex reasoning, integrating multiple sources, sustained effort, project-based / creative (create, design, compare, act out, tell your own story).
${levelsBlock}
Calibrate vocabulary and complexity to ${gv.name} (${BANDS[gv.band]?.label}). Use student-friendly language.
Return ONLY a JSON array of objects in level order, with this shape:
[{"level":1,"label":"Recall & Reproduction","items":["...","..."]}, ...]
No markdown, no preamble, no commentary.`;
    const userMsg = extraContext
      ? `Topic / standard / text: ${promptTopic}\n\nAdditional context from the teacher: ${extraContext}`
      : `Topic / standard / text: ${promptTopic}`;
    const raw = await callAiRaw({
        model: "claude-sonnet-4-20250514", max_tokens: 2000,
        system: sys,
        messages: [{ role: "user", content: userMsg }],
    }) || "[]";
    return repairAndParse(raw, { container: "array" }) as any[];
  };

  // Merge AI results into the existing levels, returning the new array and the
  // list of level numbers that are still missing usable content.
  const mergeLevels = (existing: any[], incoming: any[]) => {
    const merged = DOK_LEVEL_DEFS.map(def => {
      const prior = existing.find(p => Number(p?.level) === def.level);
      const found = incoming.find(p => Number(p?.level) === def.level);
      const newItems = Array.isArray(found?.items)
        ? found.items.map((x: any) => String(x).trim()).filter(Boolean)
        : [];
      const priorItems = Array.isArray(prior?.items)
        ? prior.items.map((x: any) => String(x).trim()).filter((s: string) => s && s !== "(add a question)")
        : [];
      const items = newItems.length ? newItems : priorItems;
      return { level: def.level, label: def.label, items };
    });
    const missing = merged.filter(lv => lv.items.length === 0).map(lv => lv.level);
    return { merged, missing };
  };

  const generate = async (clarif?: string, onlyLevels?: number[]) => {
    if (!topic.trim() || busy) return;
    setBusy(true); setErr(""); setAiNotice("");
    try {
      const parsed = await callAI(topic, onlyLevels, clarif);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("AI did not return DOK levels");
      const baseLevels = onlyLevels ? (el.levels || []) : [];
      let { merged, missing } = mergeLevels(baseLevels, parsed);

      // One automatic retry targeting just the missing levels with a stronger ask.
      if (missing.length && !onlyLevels) {
        try {
          const retry = await callAI(topic, missing, clarif);
          ({ merged, missing } = mergeLevels(merged, retry));
        } catch { /* fall through to follow-up prompt */ }
      }

      // Persist what we have so the teacher can edit it directly.
      const finalLevels = merged.map(lv => ({
        ...lv,
        items: lv.items.length ? lv.items : ["(add a question)"],
      }));
      onChange({ levels: finalLevels, mode: "ai", topic });

      if (missing.length) {
        setMissingLevels(missing);
        setAiNotice(`AI couldn't generate enough material for DOK ${missing.join(", ")}. Add a quick clarification below and we'll fill those in.`);
      } else {
        setMissingLevels([]);
        setClarification("");
        setAiNotice("✅ All 4 DOK levels generated. Edit any question below to fine-tune.");
      }
    } catch (e: any) {
      setErr(e?.message || "Could not generate. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const updateLevelItems = (li, text) => {
    const next = (el.levels || []).map((lv, i) =>
      i === li ? { ...lv, items: text.split("\n").map(s => s.trimStart()).filter(s => s.trim().length) } : lv
    );
    onChange({ levels: next });
  };

  const LBL = { display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginTop: 10, fontFamily: F };
  const LEVEL_COLORS = ["#10B981", "#0EA5E9", "#8B5CF6", "#F59E0B"];

  return (
    <div style={{ marginTop: 4 }}>
      <label style={LBL}>Title</label>
      <SpellInput type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Title" />

      <label style={LBL}>Intro / Directions</label>
      <SpellInput type="text" value={el.intro || ""} spellCheck onChange={e => onChange({ intro: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Intro line" />

      <label style={LBL}>How to fill this in</label>
      <select
        value={mode}
        onChange={e => onChange({ mode: e.target.value })}
        style={{ ...inp, marginTop: 4, minHeight: 40 }}
        aria-label="Generation mode"
      >
        <option value="manual">✍️ Build your own</option>
        <option value="ai">✨ AI generation</option>
      </select>

      {mode === "ai" && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#FAFAFA", border: "1px solid #E5E7EB" }}>
          <label style={{ ...LBL, marginTop: 0 }}>Topic, standard, or text excerpt</label>
          <SpellTextarea
            value={topic}
            spellCheck
            onChange={e => setTopic(e.target.value)}
            placeholder="e.g. Identify the main character in a short story about friendship"
            style={{ ...inp, minHeight: 70, marginTop: 4 }}
            aria-label="AI prompt"
          />
          <button
            type="button"
            onClick={() => generate()}
            disabled={busy || !topic.trim()}
            style={{ marginTop: 8, width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${gv.color}`, background: busy ? "#F3F4F6" : gv.color, color: busy ? "#6B7280" : "white", fontFamily: F, fontWeight: 800, fontSize: 13, cursor: busy ? "wait" : "pointer", minHeight: 44 }}
          >
            {busy ? "Generating…" : "✨ Generate DOK Questions"}
          </button>
          {err && <p role="alert" style={{ fontSize: 14, color: "#B91C1C", margin: "8px 0 0", fontFamily: F, lineHeight: 1.5 }}>{err}</p>}
          {aiNotice && !err && (
            <p role="status" style={{ fontSize: 12, color: missingLevels.length ? "#B45309" : "#047857", margin: "8px 0 0", fontFamily: F, lineHeight: 1.5, fontWeight: 700 }}>
              {aiNotice}
            </p>
          )}
          {missingLevels.length > 0 && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#FEF3C7", border: "1.5px solid #F59E0B" }}>
              <label style={{ ...LBL, marginTop: 0, color: "#92400E" }}>
                Follow-up: tell the AI more about DOK {missingLevels.join(", ")}
              </label>
              <SpellTextarea
                value={clarification}
                spellCheck
                onChange={e => setClarification(e.target.value)}
                placeholder="e.g. Focus on a specific text, add a real-world scenario, or describe what students should create."
                style={{ ...inp, minHeight: 60, marginTop: 4 }}
                aria-label="Clarification prompt for missing DOK levels"
              />
              <button
                type="button"
                onClick={() => generate(clarification, missingLevels)}
                disabled={busy || !clarification.trim()}
                style={{ marginTop: 8, width: "100%", padding: "10px 12px", borderRadius: 8, border: "1.5px solid #B45309", background: busy ? "#F3F4F6" : "#B45309", color: busy ? "#6B7280" : "white", fontFamily: F, fontWeight: 800, fontSize: 13, cursor: busy ? "wait" : "pointer", minHeight: 44 }}
              >
                {busy ? "Retrying…" : `↻ Fill in DOK ${missingLevels.join(", ")}`}
              </button>
            </div>
          )}
        </div>
      )}

      <p style={{ fontSize: 11, color: "#6B7280", margin: "12px 0 0", fontFamily: F, lineHeight: 1.5 }}>
        ✏️ All questions below are editable — tweak the AI's wording, add your own, or remove ones you don't need. One question per line.
      </p>

      {DOK_LEVEL_DEFS.map((def, li) => {
        const lv = (el.levels || [])[li] || { level: def.level, label: def.label, items: [] };
        const c = LEVEL_COLORS[li];
        return (
          <div key={def.level} style={{ marginTop: 10, padding: 10, borderRadius: 8, background: c + "10", border: `1.5px solid ${c}55` }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: c, margin: 0, fontFamily: F }}>
              DOK {def.level} · {def.label}
            </p>
            <p style={{ fontSize: 10, color: "#6B7280", margin: "2px 0 6px", fontFamily: F, fontStyle: "italic" }}>
              {def.desc}
            </p>
            <SpellTextarea
              value={(lv.items || []).join("\n")}
              spellCheck
              onChange={e => updateLevelItems(li, e.target.value)}
              style={{ ...inp, minHeight: 80, marginTop: 4 }}
              placeholder="One question per line"
              aria-label={`DOK Level ${def.level} questions`}
            />
          </div>
        );
      })}
    </div>
  );
      }


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CHECKLIST EDITOR (Success Criteria & Exit Ticket)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ChecklistEditor({ el, onChange, gv, inp }) {
  const isSuccess = el.type === "successCriteria";
  const accent = isSuccess ? gv.color : "#0369A1";
  const mode = el.mode || "manual";
  const [topic, setTopic] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const generate = async () => {
    if (!topic.trim() || busy) return;
    setBusy(true); setErr("");
    const sysSuccess = `You design student-friendly success criteria for K–12 lessons. Success criteria are specific, measurable, standards-aligned skills written as "I can …" statements. They tell students exactly what to demonstrate to meet a learning objective. Calibrate vocabulary and complexity to ${gv.name} (${BANDS[gv.band]?.label}). Return ONLY a JSON array of 3–6 short "I can …" strings — no markdown, no preamble. Example: ["I can look at the picture.","I can read the text.","I can identify the character in the story."]`;
    const sysExit = `You design quick formative exit tickets for K–12 lessons. Exit tickets are brief (1–5 minute) end-of-lesson self-checks. Items should be checkable statements students can mark off, e.g. participation, completion, or demonstration of one specific concept. Calibrate vocabulary to ${gv.name} (${BANDS[gv.band]?.label}). Return ONLY a JSON array of 3–6 short statements — no markdown, no preamble. Example: ["I participated in class.","I completed the reading assignment.","I participated in at least two center activities."]`;
    try {
      const raw = await callAiRaw({
          model: "claude-sonnet-4-20250514", max_tokens: 500,
          system: isSuccess ? sysSuccess : sysExit,
          messages: [{ role: "user", content: `Topic / lesson objective: ${topic}` }],
      }) || "[]";
      const clean = raw.replace(/```json|```/g, "").trim();
      const s = clean.indexOf("["); const e = clean.lastIndexOf("]");
      const slice = s >= 0 && e > s ? clean.slice(s, e + 1) : clean;
      const parsed = JSON.parse(slice);
      if (!Array.isArray(parsed) || !parsed.length) throw new Error("AI did not return a list");
      onChange({ items: parsed.map(x => String(x).trim()).filter(Boolean), mode: "ai" });
    } catch (e) {
      setErr(e?.message || "Could not generate. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const LBL = { display: "block", fontSize: 11, fontWeight: 700, color: "#374151", marginTop: 10, fontFamily: F };

  return (
    <div style={{ marginTop: 4 }}>
      <label style={LBL}>Title</label>
      <SpellInput type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Title" />

      <label style={LBL}>Intro / Directions</label>
      <SpellInput type="text" value={el.intro || ""} spellCheck onChange={e => onChange({ intro: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Intro line" />

      <label style={LBL}>How to fill this in</label>
      <select
        value={mode}
        onChange={e => onChange({ mode: e.target.value })}
        style={{ ...inp, marginTop: 4, minHeight: 40 }}
        aria-label="Generation mode"
      >
        <option value="manual">✍️ Build your own</option>
        <option value="ai">✨ AI generation</option>
      </select>

      {mode === "ai" && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: "#FAFAFA", border: "1px solid #E5E7EB" }}>
          <label style={{ ...LBL, marginTop: 0 }}>{isSuccess ? "Learning objective / standard" : "Lesson topic or focus"}</label>
          <SpellTextarea
            value={topic}
            spellCheck
            onChange={e => setTopic(e.target.value)}
            placeholder={isSuccess ? "e.g. Identify the main character in a short story" : "e.g. End of ELA lesson on character traits"}
            style={{ ...inp, minHeight: 60, marginTop: 4 }}
            aria-label="AI prompt"
          />
          <button
            type="button"
            onClick={generate}
            disabled={busy || !topic.trim()}
            style={{ marginTop: 8, width: "100%", padding: "10px 12px", borderRadius: 8, border: `1.5px solid ${accent}`, background: busy ? "#F3F4F6" : accent, color: busy ? "#6B7280" : "white", fontFamily: F, fontWeight: 800, fontSize: 13, cursor: busy ? "wait" : "pointer", minHeight: 44 }}
          >
            {busy ? "Generating…" : `✨ Generate ${isSuccess ? "Success Criteria" : "Exit Ticket"}`}
          </button>
          {err && <p role="alert" style={{ fontSize: 12, color: "#B91C1C", margin: "8px 0 0", fontFamily: F, lineHeight: 1.5 }}>{err}</p>}
        </div>
      )}

      <label style={LBL}>Items {mode === "ai" ? "(generated — edit freely; one per line)" : "(one per line)"}</label>
      <SpellTextarea
        value={(el.items || []).join("\n")}
        spellCheck
        onChange={e => onChange({ items: e.target.value.split("\n").map(s => s.trimStart()).filter(s => s.trim().length) })}
        style={{ ...inp, minHeight: 110, marginTop: 4 }}
        placeholder={isSuccess ? "I can look at the picture.\nI can read the text.\nI can identify the character in the story." : "I participated in class.\nI completed the reading assignment.\nI participated in at least two center activities."}
        aria-label="Checklist items"
      />
      <p style={{ fontSize: 11, color: "#6B7280", margin: "6px 0 0", fontFamily: F, lineHeight: 1.5 }}>
        Each item appears on the worksheet with a check-off box.
      </p>
    </div>
  );
}

function CustomShapeEditor({ el, onChange, gv, inp }) {
  const shapes = el.shapes || [];
  const [activeIdx, setActiveIdx] = useState(0);
  const [editorTab, setEditorTab] = useState("presets"); // "presets" | "custom"
  const active = shapes[activeIdx] || shapes[0];

  // ── BUILD PRESETS ──────────────────────────────────────────────────
  const BUILD_PRESETS = [
    {
      id: "vocab",
      label: "Vocabulary Cards",
      icon: "🔤",
      desc: "4-card grid — word, definition, picture box, sentence",
      layout: "2-col",
      title: "Vocabulary",
      shapes: [
        { shape:"rounded", label:"Word", fill:"#EFF6FF", border:"#0369A1", borderWidth:2, width:180, height:60,  lines:0, caption:"" },
        { shape:"rounded", label:"Picture", fill:"#F9FAFB", border:"#9CA3AF", borderWidth:1.5, width:180, height:100, lines:0, caption:"Draw or paste image here" },
        { shape:"rectangle", label:"Definition", fill:"#FFFFFF", border:"#0369A1", borderWidth:1.5, width:180, height:90, lines:3, caption:"" },
        { shape:"rectangle", label:"Use it in a sentence", fill:"#FFFFFF", border:"#0369A1", borderWidth:1.5, width:180, height:80, lines:2, caption:"" },
      ],
    },
    {
      id: "kwl",
      label: "KWL Chart",
      icon: "📊",
      desc: "3 columns: Know / Want to Know / Learned",
      layout: "3-col",
      title: "KWL Chart",
      shapes: [
        { shape:"rectangle", label:"K — What I KNOW", fill:"#FFF7ED", border:"#B45309", borderWidth:2, width:180, height:220, lines:6, caption:"" },
        { shape:"rectangle", label:"W — What I WANT to Know", fill:"#F0F9FF", border:"#0369A1", borderWidth:2, width:180, height:220, lines:6, caption:"" },
        { shape:"rectangle", label:"L — What I LEARNED", fill:"#F0FDF4", border:"#166534", borderWidth:2, width:180, height:220, lines:6, caption:"" },
      ],
    },
    {
      id: "venn",
      label: "Venn Diagram",
      icon: "⭕",
      desc: "Two overlapping circles with a shared middle",
      layout: "3-col",
      title: "Compare and Contrast",
      shapes: [
        { shape:"circle", label:"Topic A", fill:"#EFF6FF", border:"#0369A1", borderWidth:2, width:160, height:160, lines:3, caption:"Only Topic A" },
        { shape:"rounded", label:"Both", fill:"#F5F3FF", border:"#6D28D9", borderWidth:2, width:130, height:160, lines:4, caption:"Similarities" },
        { shape:"circle", label:"Topic B", fill:"#FFF7ED", border:"#B45309", borderWidth:2, width:160, height:160, lines:3, caption:"Only Topic B" },
      ],
    },
    {
      id: "causeeffect",
      label: "Cause & Effect",
      icon: "➡️",
      desc: "Cause box → arrow → effect box",
      layout: "3-col",
      title: "Cause and Effect",
      shapes: [
        { shape:"rounded", label:"CAUSE", fill:"#FEF2F2", border:"#DC2626", borderWidth:2, width:180, height:130, lines:3, caption:"What happened?" },
        { shape:"arrow",   label:"leads to", fill:"#F3F4F6", border:"#6B7280", borderWidth:1.5, width:120, height:60,  lines:0, caption:"" },
        { shape:"rounded", label:"EFFECT", fill:"#F0FDF4", border:"#166534", borderWidth:2, width:180, height:130, lines:3, caption:"What was the result?" },
      ],
    },
    {
      id: "storymap",
      label: "Story Map",
      icon: "📖",
      desc: "Setting, Characters, Problem, Solution, Theme",
      layout: "2-col",
      title: "Story Map",
      shapes: [
        { shape:"rounded", label:"Setting", fill:"#FFF7ED", border:"#B45309", borderWidth:2, width:190, height:90,  lines:2, caption:"When and where?" },
        { shape:"rounded", label:"Characters", fill:"#EFF6FF", border:"#0369A1", borderWidth:2, width:190, height:90,  lines:2, caption:"Who is in the story?" },
        { shape:"rounded", label:"Problem", fill:"#FEF2F2", border:"#DC2626", borderWidth:2, width:190, height:100, lines:3, caption:"What is the conflict?" },
        { shape:"rounded", label:"Solution", fill:"#F0FDF4", border:"#166534", borderWidth:2, width:190, height:100, lines:3, caption:"How is it solved?" },
        { shape:"rectangle", label:"Theme / Lesson", fill:"#F5F3FF", border:"#6D28D9", borderWidth:2, width:190, height:80,  lines:2, caption:"What did we learn?" },
      ],
    },
    {
      id: "wh",
      label: "Wh- Questions",
      icon: "❓",
      desc: "Who / What / When / Where / Why / How",
      layout: "2-col",
      title: "Answer the Questions",
      shapes: [
        { shape:"rounded", label:"Who?",   fill:"#EFF6FF", border:"#0369A1", borderWidth:2, width:190, height:90, lines:2, caption:"" },
        { shape:"rounded", label:"What?",  fill:"#FFF7ED", border:"#B45309", borderWidth:2, width:190, height:90, lines:2, caption:"" },
        { shape:"rounded", label:"When?",  fill:"#F0FDF4", border:"#166534", borderWidth:2, width:190, height:90, lines:2, caption:"" },
        { shape:"rounded", label:"Where?", fill:"#FEF2F2", border:"#DC2626", borderWidth:2, width:190, height:90, lines:2, caption:"" },
        { shape:"rounded", label:"Why?",   fill:"#F5F3FF", border:"#6D28D9", borderWidth:2, width:190, height:90, lines:2, caption:"" },
        { shape:"rounded", label:"How?",   fill:"#FEFCE8", border:"#854D0E", borderWidth:2, width:190, height:90, lines:2, caption:"" },
      ],
    },
  ];

  const applyPreset = (preset) => {
    onChange({ title: preset.title, layout: preset.layout, shapes: preset.shapes });
    setActiveIdx(0);
    setEditorTab("custom");
  };

  const updShape = (idx, updates) => {
    const next = shapes.map((s, i) => i === idx ? { ...s, ...updates } : s);
    onChange({ shapes: next });
  };

  const addShape = () => {
    const newShape = { shape:"rectangle", label:"", fill:"#FFFFFF", border:gv.color, borderWidth:2, width:180, height:120, lines:0, caption:"" };
    onChange({ shapes: [...shapes, newShape] });
    setActiveIdx(shapes.length);
  };

  const removeShape = (idx) => {
    const next = shapes.filter((_,i) => i !== idx);
    onChange({ shapes: next });
    setActiveIdx(Math.min(activeIdx, next.length - 1));
  };

  const duplicateShape = (idx) => {
    const copy = { ...shapes[idx] };
    const next = [...shapes.slice(0, idx+1), copy, ...shapes.slice(idx+1)];
    onChange({ shapes: next });
    setActiveIdx(idx+1);
  };

  const rowStyle = { display:"flex", gap:8, marginTop:4 };
  const half = { ...inp, flex:1 };

  return (
    <div>
      {/* ── Editor Tab switcher ── */}
      <div style={{ display:"flex", gap:0, marginBottom:12, border:"1.5px solid #E5E7EB", borderRadius:8, overflow:"hidden" }}>
        {[["presets","🗂️ Build Presets"],["custom","⚙️ Customize"]].map(([id,lbl]) => (
          <button key={id} onClick={() => setEditorTab(id)} aria-pressed={editorTab===id}
            style={{ flex:1, padding:"9px 6px", border:"none", borderRight:id==="presets"?"1px solid #E5E7EB":"none", background:editorTab===id ? gv.color : "white", color:editorTab===id ? "white" : "#374151", fontFamily:F, fontWeight:700, fontSize:12, cursor:"pointer", transition:"all 0.12s" }}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── BUILD PRESETS TAB ── */}
      {editorTab === "presets" && (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          <p style={{ fontFamily:F, fontSize:11.5, color:"#9CA3AF", margin:"0 0 6px", lineHeight:1.5 }}>
            Click a preset to instantly build a complete graphic organizer. You can customize it after.
          </p>
          {BUILD_PRESETS.map(preset => (
            <button key={preset.id} onClick={() => applyPreset(preset)}
              style={{ display:"flex", alignItems:"flex-start", gap:10, padding:"11px 13px", borderRadius:9, border:`1.5px solid #E5E7EB`, background:"white", cursor:"pointer", textAlign:"left", transition:"all 0.12s", width:"100%" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = gv.color; e.currentTarget.style.background = gv.light; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}>
              <span style={{ fontSize:22, flexShrink:0, marginTop:1 }}>{preset.icon}</span>
              <div>
                <div style={{ fontFamily:F, fontWeight:700, fontSize:13, color:"#111827", marginBottom:2 }}>{preset.label}</div>
                <div style={{ fontFamily:F, fontSize:11.5, color:"#9CA3AF", lineHeight:1.4 }}>{preset.desc} · {preset.shapes.length} sections</div>
              </div>
            </button>
          ))}
          {el.shapes?.length > 0 && (
            <p style={{ fontFamily:F, fontSize:11, color:gv.color, margin:"4px 0 0", textAlign:"center" }}>
              ✓ Preset applied — switch to <strong>Customize</strong> to edit individual shapes
            </p>
          )}
        </div>
      )}

      {/* ── CUSTOMIZE TAB ── */}
      {editorTab === "custom" && (<>
      {/* Layout & title */}
      <label style={LBL}>Prompt / Title</label>
      <SpellInput type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop:4 }} aria-label="Shape group title" placeholder="Label each shape:" />

      <label style={LBL}>Layout</label>
      <div style={{ display:"flex", gap:6, marginTop:4, flexWrap:"wrap" }}>
        {[["1-col","1"],["2-col","2"],["3-col","3"],["4-col","4"]].map(([v,lbl]) => (
          <button key={v} onClick={() => {
            // Auto-add empty shapes so the new column count is actually filled.
            const targetCols = parseInt(lbl, 10);
            const current = el.shapes || [];
            const updates: any = { layout: v };
            if (current.length < targetCols) {
              const blank = { shape:"rectangle", label:"", fill:"#FFFFFF", border:gv.color, borderWidth:2, width:180, height:120, lines:0, caption:"" };
              const extras = Array.from({ length: targetCols - current.length }, () => ({ ...blank }));
              updates.shapes = [...current, ...extras];
            }
            onChange(updates);
          }} aria-pressed={el.layout===v}
            style={{ padding:"5px 12px", borderRadius:6, border:`1.5px solid ${el.layout===v ? gv.color : "#E5E7EB"}`, background:el.layout===v ? gv.light : "white", color:el.layout===v ? gv.color : "#6B7280", fontFamily:F, fontWeight:700, fontSize:12, cursor:"pointer" }}>
            {lbl} col
          </button>
        ))}
      </div>

      <label style={LBL}>Orientation</label>
      <div style={{ display:"flex", gap:6, marginTop:4 }}>
        {[["horizontal","↔ Horizontal","Arrange shapes across in columns"],["vertical","↕ Vertical","Stack shapes top-to-bottom in one column"]].map(([v,lbl,desc]) => {
          const active = (el.orientation || "horizontal") === v;
          return (
            <button key={v} onClick={() => onChange({ orientation: v })} aria-pressed={active} title={desc}
              style={{ flex:1, padding:"6px 10px", borderRadius:6, border:`1.5px solid ${active ? gv.color : "#E5E7EB"}`, background:active ? gv.light : "white", color:active ? gv.color : "#6B7280", fontFamily:F, fontWeight:700, fontSize:12, cursor:"pointer" }}>
              {lbl}
            </button>
          );
        })}
      </div>
      <p style={{ fontFamily:F, fontSize:10.5, color:"#9CA3AF", margin:"4px 0 0" }}>
        {(el.orientation || "horizontal") === "vertical" ? "Shapes stack in a single column (top to bottom)." : "Shapes spread across the selected number of columns."}
      </p>

      {/* Shape tabs */}
      <div style={{ marginTop:16, paddingTop:14, borderTop:"1px solid #F3F4F6" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
          <span style={{ fontFamily:F, fontSize:10, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:0.8 }}>Shapes ({shapes.length})</span>
          <button onClick={addShape} style={{ padding:"3px 10px", borderRadius:6, border:`1.5px solid ${gv.color}`, background:gv.light, color:gv.color, fontFamily:F, fontWeight:700, fontSize:11, cursor:"pointer" }} aria-label="Add another shape">+ Add</button>
        </div>

        {/* Shape selector tabs */}
        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
          {shapes.map((_,i) => (
            <button key={i} onClick={() => setActiveIdx(i)} aria-pressed={activeIdx===i}
              style={{ padding:"3px 10px", borderRadius:6, border:`1.5px solid ${activeIdx===i ? gv.color : "#E5E7EB"}`, background:activeIdx===i ? gv.color : "white", color:activeIdx===i ? "white" : "#6B7280", fontFamily:F, fontWeight:700, fontSize:11, cursor:"pointer" }}>
              #{i+1}
            </button>
          ))}
        </div>

        {/* Active shape editor */}
        {active && (
          <div style={{ background:"#F9FAFB", borderRadius:8, padding:"12px 12px 14px", border:"1px solid #E5E7EB" }}>

            <label style={LBL}>Shape Type</label>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:5, marginTop:4 }}>
              {SHAPE_TYPES.map(st => (
                <button key={st.id} onClick={() => updShape(activeIdx, { shape:st.id })} aria-pressed={active.shape===st.id}
                  style={{ padding:"5px 6px", borderRadius:6, border:`1.5px solid ${active.shape===st.id ? gv.color : "#E5E7EB"}`, background:active.shape===st.id ? gv.light : "white", color:active.shape===st.id ? gv.color : "#374151", fontFamily:F, fontWeight:600, fontSize:11, cursor:"pointer", textAlign:"left" }}>
                  {st.label}
                </button>
              ))}
            </div>

            <label style={LBL}>Label inside shape</label>
            <SpellInput type="text" value={active.label||""} spellCheck onChange={e => updShape(activeIdx, { label:e.target.value })} style={{ ...inp, marginTop:4 }} aria-label="Shape label" placeholder="e.g. Part A" />

            <label style={LBL}>Caption below shape</label>
            <SpellInput type="text" value={active.caption||""} spellCheck onChange={e => updShape(activeIdx, { caption:e.target.value })} style={{ ...inp, marginTop:4 }} aria-label="Caption below shape" placeholder="Optional description" />

            <label style={LBL}>Write lines inside</label>
            <input type="number" min={0} max={10} value={active.lines||0} onChange={e => updShape(activeIdx, { lines:parseInt(e.target.value)||0 })} style={{ ...inp, marginTop:4 }} aria-label="Lines inside shape" />

            <div style={rowStyle}>
              <div style={{ flex:1 }}>
                <label style={LBL}>Width (px)</label>
                <input type="number" min={60} max={400} step={10} value={active.width||180} onChange={e => updShape(activeIdx, { width:parseInt(e.target.value)||180 })} style={{ ...half, marginTop:4 }} aria-label="Shape width" />
              </div>
              <div style={{ flex:1 }}>
                <label style={LBL}>Height (px)</label>
                <input type="number" min={40} max={400} step={10} value={active.height||120} onChange={e => updShape(activeIdx, { height:parseInt(e.target.value)||120 })} style={{ ...half, marginTop:4 }} aria-label="Shape height" />
              </div>
            </div>

            <div style={rowStyle}>
              <div style={{ flex:1 }}>
                <label style={LBL}>Fill Color</label>
                <div style={{ display:"flex", gap:6, marginTop:4, alignItems:"center" }}>
                  <input type="color" value={active.fill||"#FFFFFF"} onChange={e => updShape(activeIdx, { fill:e.target.value })} style={{ width:34, height:30, borderRadius:5, border:"1.5px solid #E5E7EB", cursor:"pointer", padding:2 }} aria-label="Shape fill color" />
                  <input type="text" value={active.fill||"#FFFFFF"} onChange={e => updShape(activeIdx, { fill:e.target.value })} style={{ ...half, fontSize:12 }} aria-label="Fill color hex" />
                </div>
              </div>
              <div style={{ flex:1 }}>
                <label style={LBL}>Border Color</label>
                <div style={{ display:"flex", gap:6, marginTop:4, alignItems:"center" }}>
                  <input type="color" value={active.border||gv.color} onChange={e => updShape(activeIdx, { border:e.target.value })} style={{ width:34, height:30, borderRadius:5, border:"1.5px solid #E5E7EB", cursor:"pointer", padding:2 }} aria-label="Shape border color" />
                  <input type="text" value={active.border||gv.color} onChange={e => updShape(activeIdx, { border:e.target.value })} style={{ ...half, fontSize:12 }} aria-label="Border color hex" />
                </div>
              </div>
            </div>

            <label style={LBL}>Border Thickness (px)</label>
            <input type="number" min={0} max={12} value={active.borderWidth||2} onChange={e => updShape(activeIdx, { borderWidth:parseInt(e.target.value)||2 })} style={{ ...inp, marginTop:4 }} aria-label="Border width" />

            {/* Shape quick-presets */}
            <label style={{ ...LBL, marginTop:14 }}>Quick Presets</label>
            <div style={{ display:"flex", gap:5, marginTop:4, flexWrap:"wrap" }}>
              {[
                { label:"Answer Box",   props:{ shape:"rectangle", fill:"#FFFFFF", border:"#374151", borderWidth:1.5, lines:3, height:100 } },
                { label:"Blank Circle", props:{ shape:"circle",    fill:"#FFFFFF", border:"#6D28D9", borderWidth:2,   lines:0, width:130, height:130 } },
                { label:"Label Tag",    props:{ shape:"rounded",   fill:"#F5F3FF", border:"#6D28D9", borderWidth:2,   lines:0, height:60  } },
                { label:"Note Cloud",   props:{ shape:"cloud",     fill:"#FEFCE8", border:"#B45309", borderWidth:2,   lines:2, height:110 } },
                { label:"Speech",       props:{ shape:"speech",    fill:"#F0F9FF", border:"#0369A1", borderWidth:2,   lines:2, height:110 } },
              ].map(preset => (
                <button key={preset.label} onClick={() => updShape(activeIdx, preset.props)}
                  style={{ padding:"4px 9px", borderRadius:6, border:"1.5px solid #E5E7EB", background:"white", color:"#374151", fontFamily:F, fontWeight:600, fontSize:10.5, cursor:"pointer" }}>
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Duplicate / Remove */}
            <div style={{ display:"flex", gap:6, marginTop:14 }}>
              <button onClick={() => duplicateShape(activeIdx)} style={{ flex:1, padding:"6px 0", borderRadius:7, border:`1.5px solid ${gv.color}`, background:gv.light, color:gv.color, fontFamily:F, fontWeight:700, fontSize:12, cursor:"pointer" }} aria-label="Duplicate this shape">Duplicate</button>
              {shapes.length > 1 && <button onClick={() => removeShape(activeIdx)} style={{ flex:1, padding:"6px 0", borderRadius:7, border:"1.5px solid #FCA5A5", background:"#FEF2F2", color:"#DC2626", fontFamily:F, fontWeight:700, fontSize:12, cursor:"pointer" }} aria-label="Remove this shape">Remove</button>}
            </div>
          </div>
        )}
      </div>
      </>)}
    </div>
  );
}

const gradeIdToStdBand = (gradeId, subj) => {
  const bands = Object.keys(NY_STANDARDS[subj] || {});
  if (subj === "ELA") {
    const map = { pk: "Pre-Kindergarten", k: "Kindergarten", "1": "Grade 1", "2": "Grade 2", "3": "Grade 3", "4": "Grade 4", "5": "Grade 5", "6": "Grade 6", "7": "Grade 7", "8": "Grade 8", "9": "Grades 9-10", "10": "Grades 9-10", "11": "Grades 11-12", "12": "Grades 11-12" };
    return bands.includes(map[gradeId]) ? map[gradeId] : bands[0] || "";
  }
  if (["pk","k","1","2"].includes(gradeId)) return bands.find(b => /Pre-?K|K\b|– 2|to 2|1[-–]2/i.test(b)) || bands[0] || "";
  if (["3","4","5"].includes(gradeId))    return bands.find(b => /3[-–]5|3 ?– ?5/i.test(b))   || bands[0] || "";
  if (["6","7","8"].includes(gradeId))    return bands.find(b => /6[-–]8|6 ?– ?8/i.test(b))   || bands[0] || "";
  if (["9","10","11","12"].includes(gradeId)) return bands.find(b => /9[-–]12|9 ?– ?12/i.test(b)) || bands[0] || "";
  return bands[0] || "";
};

function StandardsModal({ gv, onClose, onInsert, onGenerate, gradeId }) {
  const subjects = Object.keys(NY_STANDARDS);
  const [subj, setSubj] = useState("ELA");
  const [band, setBand] = useState(() => gradeId ? (gradeIdToStdBand(gradeId, "ELA") || "Kindergarten") : "Kindergarten");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(null);
  const [showHeader, setShowHeader] = useState(true);
  const [matchGrade, setMatchGrade] = useState(!!gradeId);

  const bands = Object.keys(NY_STANDARDS[subj] || {});
  const stds = NY_STANDARDS[subj]?.[band] || [];
  const filtered = search.trim()
    ? stds.filter(s => s.code.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase()))
    : stds;

  const handlePick = (s) => { setPicked(s); };

  // Auto-update band when subject changes if matchGrade is on
  const onSubjChange = (s) => {
    setSubj(s);
    if (matchGrade && gradeId) setBand(gradeIdToStdBand(gradeId, s));
    else setBand(s === "ELA" ? "Kindergarten" : Object.keys(NY_STANDARDS[s] || {})[0] || "");
    setPicked(null);
  };

  const toggleMatchGrade = () => {
    setMatchGrade(m => {
      const next = !m;
      if (next && gradeId) setBand(gradeIdToStdBand(gradeId, subj));
      return next;
    });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 18, maxWidth: 680, width: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "fadeIn 0.25s ease" }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "20px 24px 14px", borderBottom: "2px solid #F0F0F0", background: gv.light }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>🗽 New York State Standards</h2>
            <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16, color: "#888", fontWeight: 800 }}>✕</button>
          </div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#999", fontFamily: F }}>Select a standard to insert it on your worksheet or let AI design the entire worksheet from it.</p>
        </div>

        {/* Filters */}
        <div style={{ padding: "14px 24px", display: "flex", gap: 12, flexWrap: "wrap", background: "#FAFAFA", borderBottom: "1px solid #EEE" }}>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={{ ...LBL, marginTop: 0 }}>Subject</label>
            <select value={subj} onChange={e => onSubjChange(e.target.value)} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "2px solid #EEE", fontFamily: F, fontSize: 13, outline: "none" }}>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={{ ...LBL, marginTop: 0 }}>Grade Band</label>
            <select value={band} onChange={e => { setBand(e.target.value); setMatchGrade(false); setPicked(null); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "2px solid #EEE", fontFamily: F, fontSize: 13, outline: "none" }}>
              {bands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ ...LBL, marginTop: 0 }}>Search Standards</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code or keyword…" style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "2px solid #EEE", fontFamily: F, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
          {gradeId && (
            <div style={{ width: "100%", display: "flex", alignItems: "center", gap: 8 }}>
              <button onClick={toggleMatchGrade}
                title={`Match ${GRADES.find(g => g.id === gradeId)?.name || gradeId}`}
                style={{ padding: "3px 8px", borderRadius: 10, border: `1px solid ${matchGrade ? gv.color : "#DDD"}`, background: matchGrade ? gv.light : "white", color: matchGrade ? gv.color : "#666", fontFamily: F, fontWeight: 700, fontSize: 10, cursor: "pointer", whiteSpace: "nowrap" }}>
                {matchGrade ? "✓ " : ""}🎯 Match grade
              </button>
              <span style={{ fontSize: 10, color: "#999", fontFamily: F }}>{filtered.length} standard{filtered.length === 1 ? "" : "s"}</span>
            </div>
          )}
        </div>

        {/* Standard list */}
        <div style={{ overflowY: "auto", padding: "14px 24px 8px", flex: 1 }}>
          {filtered.length === 0 && <p style={{ fontFamily: F, color: "#CCC", textAlign: "center", marginTop: 24 }}>No standards match your search.</p>}
          {filtered.map((s, i) => {
            const isSelected = picked?.code === s.code;
            return (
              <div key={i} onClick={() => handlePick(s)}
                style={{ padding: "12px 16px", borderRadius: 12, border: `2px solid ${isSelected ? gv.color : "#EEE"}`, marginBottom: 8, cursor: "pointer", transition: "all 0.15s", background: isSelected ? gv.light : "white", transform: isSelected ? "translateX(3px)" : "none" }}
                onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.borderColor = gv.color + "80"; e.currentTarget.style.background = gv.light + "88"; } }}
                onMouseLeave={e => { if (!isSelected) { e.currentTarget.style.borderColor = "#EEE"; e.currentTarget.style.background = "white"; } }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: F, fontSize: 11, fontWeight: 900, color: gv.color, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.code}</div>
                    <div style={{ fontFamily: F, fontSize: 13, color: "#444", lineHeight: 1.45 }}>{s.desc}</div>
                  </div>
                  {isSelected && <div style={{ width: 22, height: 22, borderRadius: "50%", background: gv.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 2 }}><span style={{ color: "white", fontSize: 12, fontWeight: 900 }}>✓</span></div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Action panel — shown when a standard is selected */}
        {picked && (
          <div style={{ borderTop: `3px solid ${gv.color}30`, background: gv.light, padding: "16px 24px", animation: "fadeIn 0.2s ease" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontFamily: F, fontSize: 10, fontWeight: 900, color: gv.color, textTransform: "uppercase", letterSpacing: 0.5 }}>Selected: {picked.code}</span>
                <p style={{ fontFamily: F, fontSize: 12.5, color: "#555", margin: "3px 0 0", lineHeight: 1.4 }}>{picked.desc}</p>
              </div>
              <button onClick={() => setPicked(null)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#BBB", fontSize: 16, padding: 2, flexShrink: 0 }}>✕</button>
            </div>

            {/* Options row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              {/* Toggle: show standard as header */}
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <div onClick={() => setShowHeader(h => !h)} style={{ width: 36, height: 20, borderRadius: 10, background: showHeader ? gv.color : "#CCC", position: "relative", transition: "background 0.2s", flexShrink: 0, cursor: "pointer" }}>
                  <div style={{ position: "absolute", top: 3, left: showHeader ? 18 : 3, width: 14, height: 14, borderRadius: "50%", background: "white", transition: "left 0.2s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)" }} />
                </div>
                <span style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: showHeader ? "#333" : "#AAA" }}>
                  Show standard as header on worksheet
                </span>
              </label>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <button onClick={() => { onInsert(picked, showHeader); onClose(); }}
                  style={{ padding: "8px 16px", borderRadius: 9, border: `2px solid ${gv.color}`, background: "white", color: gv.color, fontFamily: F, fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = gv.light; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "white"; }}>
                  ✏️ Insert Standard
                </button>
                <button onClick={() => { onGenerate(picked, showHeader); onClose(); }}
                  style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: gv.color, color: "white", fontFamily: FF, fontSize: 14, cursor: "pointer", boxShadow: `0 3px 12px ${gv.color}55`, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 6px 18px ${gv.color}66`; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = `0 3px 12px ${gv.color}55`; }}>
                  ✨ Generate Full Worksheet
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// QUIZ VERSIONS MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const VERSION_LABELS = ["A", "B", "C", "D"];

// Shuffle helper
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Identify "question" elements eligible for randomization
const isQuestion = (el) => ["multipleChoice","truefalse","shortAnswer","fillBlank","blank","matching"].includes(el.type);

function VersionsModal({ gv, ws, onClose }) {
  const [numVersions, setNumVersions] = useState(2);
  const [randomize, setRandomize] = useState(true);
  const [keepFixed, setKeepFixed] = useState(true); // keep non-question elements (instructions, passages) in place
  const [previewVer, setPreviewVer] = useState(null); // null = config, 0-3 = preview index

  // Build a version's element order
  const buildVersion = (label) => {
    const fixed = keepFixed
      ? ws.elements.filter(el => !isQuestion(el))
      : [];
    const questions = ws.elements.filter(el => isQuestion(el));
    const orderedQs = randomize ? shuffle(questions) : questions;
    if (!keepFixed) return randomize ? shuffle([...ws.elements]) : [...ws.elements];
    // Re-interleave: put questions back in their (shuffled) positions
    let qi = 0;
    return ws.elements.map(el => isQuestion(el) ? orderedQs[qi++] : el);
  };

  const versions = VERSION_LABELS.slice(0, numVersions).map(buildVersion);

  const printVersions = () => {
    const gv2 = gInfo(ws.gradeId);
    const renderEl = (el) => {
      if (!el) return "";
      const fs = gv2.fontSize;
      const mb = (s) => inlineMarkdownToHtml(s || "");
      if (el.type === "instruction") return `<div style="background:#FFFACD;padding:10px 16px;border-radius:10px;border-left:6px solid ${gv2.color};margin-bottom:16px;font-size:${Math.max(fs-7,13)}px;font-weight:700;line-height:1.55">${mb(el.text)}</div>`;
      if (el.type === "text") return `<p style="font-size:${fs}px;font-weight:600;margin:0 0 16px;line-height:1.7">${mb(el.text)}</p>`;
      if (el.type === "multipleChoice") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 10px">${mb(el.question)}</p>${(el.choices||[]).map(c=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:50%;border:2.5px solid ${gv2.color};flex-shrink:0"></div><span style="font-size:${fs}px">${mb(c)}</span></div>`).join("")}</div>`;
      if (el.type === "truefalse") return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs-5,13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">True or False? Circle your answer.</p>${(el.statements||[]).map(s=>`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:8px 12px;background:${gv2.light};border-radius:8px"><span style="font-size:${fs}px">${mb(s)}</span><span style="font-size:12px;font-weight:900;color:${gv2.color};margin-left:20px;white-space:nowrap">TRUE &nbsp;&nbsp; FALSE</span></div>`).join("")}</div>`;
      if (el.type === "shortAnswer") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.question)}</p>${Array.from({length:el.lines||4}).map(()=>`<div style="height:${gv2.lineH*0.9}px;border-bottom:2px solid #CCC;margin-bottom:6px"></div>`).join("")}</div>`;
      if (el.type === "fillBlank") return `<div style="margin-bottom:18px">${el.note?`<p style="font-size:12px;color:#999;margin:0 0 6px">${mb(el.note)}</p>`:""}<p style="font-size:${fs}px;line-height:1.9;margin:0">${(el.text||"").split("______").map((p,i,a)=>i<a.length-1?`${mb(p)}<span style="display:inline-block;width:90px;border-bottom:2.5px solid ${gv2.color};vertical-align:bottom;margin:0 3px"></span>`:mb(p)).join("")}</p></div>`;
      if (el.type === "blank") return `<div style="margin-bottom:18px">${el.label?`<p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.label)}</p>`:""} ${Array.from({length:el.lines||3}).map(()=>`<div style="height:${gv2.lineH}px;border-bottom:2.5px solid #CCC;margin-bottom:8px"></div>`).join("")}</div>`;
      if (el.type === "matching") return `<div style="margin-bottom:18px">${el.title?`<p style="font-size:${Math.max(fs-4,13)}px;font-weight:800;margin:0 0 12px">${mb(el.title)}</p>`:""}<table style="width:100%"><tbody>${(el.left||[]).map((item,i)=>`<tr><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb(item)}</td><td style="text-align:center;padding:0 8px">—</td><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb((el.right||[])[i]||"")}</td></tr>`).join("")}</tbody></table></div>`;
      if (el.type === "wordBank") return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs-4,13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">${el.title||"Word Bank"}</p><div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${gv2.light};border-radius:10px">${(el.words||[]).map(w=>`<span style="font-size:${fs}px;padding:4px 12px;border:2px solid ${gv2.color};border-radius:50px;background:white">${mb(w)}</span>`).join("")}</div></div>`;
      if (el.type === "essay") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.prompt)}</p>${Array.from({length:el.lines||14}).map(()=>`<div style="height:${gv2.lineH*0.75}px;border-bottom:1.5px solid #DDD;margin-bottom:4px"></div>`).join("")}</div>`;
      if (el.type === "divider") return `<div style="margin:8px 0;text-align:center;color:${gv2.color};font-size:16px">✦</div>`;
      if (el.type === "successCriteria" || el.type === "exitTicket") {
        const a = el.type === "successCriteria" ? gv2.color : "#0369A1";
        const bg2 = el.type === "successCriteria" ? gv2.light : "#EFF6FF";
        return `<div style="margin-bottom:18px;background:${bg2};border:2px solid ${a}45;border-left:6px solid ${a};border-radius:10px;padding:12px 16px">${el.title?`<p style="font-size:${Math.max(fs-2,13)}px;font-weight:900;color:${a};margin:0 0 6px">${el.title}</p>`:""}${el.intro?`<p style="font-size:${Math.max(fs-4,11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>`:""}<ul style="list-style:none;padding:0;margin:0">${(el.items||[]).map(item=>`<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px"><span style="flex-shrink:0;display:inline-block;width:18px;height:18px;margin-top:2px;border:2px solid ${a};border-radius:4px;background:white"></span><span style="font-size:${fs}px;font-weight:600;color:#111827;line-height:1.45">${mb(item)}</span></li>`).join("")}</ul></div>`;
      }
      if (el.type === "dokQuestions") {
        const LC = ["#10B981","#0EA5E9","#8B5CF6","#F59E0B"];
        return `<div style="margin-bottom:18px;background:#FFFFFF;border:2px solid ${gv2.color}45;border-left:6px solid ${gv2.color};border-radius:10px;padding:12px 16px">${el.title?`<p style="font-size:${Math.max(fs-2,13)}px;font-weight:900;color:${gv2.color};margin:0 0 6px">${el.title}</p>`:""}${el.intro?`<p style="font-size:${Math.max(fs-4,11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>`:""}${(el.levels||[]).map((lv,li)=>{const c=LC[(lv.level||li+1)-1]||gv2.color;return `<div style="background:${c}10;border:1.5px solid ${c}55;border-radius:8px;padding:8px 10px;margin-bottom:8px"><p style="font-size:${Math.max(fs-4,11)}px;font-weight:900;color:${c};margin:0 0 6px">DOK ${lv.level} · ${lv.label}</p><ul style="list-style:none;padding:0;margin:0">${(lv.items||[]).map(q=>`<li style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px"><span style="flex-shrink:0;display:inline-block;width:16px;height:16px;margin-top:2px;border:2px solid ${c};border-radius:3px;background:white"></span><span style="font-size:${Math.max(fs-1,12)}px;font-weight:600;color:#111827;line-height:1.45">${mb(q)}</span></li>`).join("")}</ul></div>`}).join("")}</div>`;
      }
      return "";
    };

    const pages = versions.map((els, vi) => {
      const vLabel = VERSION_LABELS[vi];
      return `
      <div class="page" style="page-break-after:always;padding:52px 64px;min-height:900px;font-family:'Nunito',sans-serif;position:relative">
        ${ws.showGrade ? `<div style="position:absolute;top:14px;right:18px;background:${gv2.light};border:2px solid ${gv2.color}40;border-radius:20px;padding:3px 13px;font-size:11px;font-weight:900;color:${gv2.color}">Version ${vLabel} · ${gv2.emoji} ${gv2.name}</div>` : `<div style="position:absolute;top:14px;right:18px;background:${gv2.light};border:2px solid ${gv2.color}40;border-radius:20px;padding:3px 13px;font-size:11px;font-weight:900;color:${gv2.color}">Version ${vLabel}</div>`}
        <div style="border-bottom:3px solid ${gv2.color}25;padding-bottom:8px;margin-bottom:16px">
          <h1 style="font-family:'Fredoka One',cursive;color:${gv2.color};font-size:${gv2.fontSize+6}px;margin:0 0 14px;padding-right:120px">${ws.title} — Version ${vLabel}</h1>
          <div style="display:flex;gap:44px">${ws.showName?`<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize-10,12)}px">Name:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>`:""} ${ws.showDate?`<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize-10,12)}px">Date:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>`:""}</div>
        </div>
        ${els.map(renderEl).join("")}
      </div>`;
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ws.title} — Quiz Versions</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;font-family:'Nunito',sans-serif}@media print{.page{page-break-after:always}}</style></head><body>${pages}</body></html>`;
    const w = window.open("", "_blank");
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 18, maxWidth: 620, width: "100%", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "fadeIn 0.25s ease" }} onClick={e => e.stopPropagation()}>

        <div style={{ padding: "20px 24px 14px", borderBottom: "2px solid #F0F0F0", background: gv.light, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>🔀 Quiz Versions</h2>
            <p style={{ margin: "5px 0 0", fontSize: 12, color: "#999", fontFamily: F }}>Create multiple randomized versions of this worksheet to prevent copying.</p>
          </div>
          <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16, color: "#888", fontWeight: 800 }}>✕</button>
        </div>

        <div style={{ overflowY: "auto", padding: "20px 24px", flex: 1 }}>

          {/* Config */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div>
              <label style={{ ...LBL, marginTop: 0 }}>Number of Versions</label>
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                {[1,2,3,4].map(n => (
                  <button key={n} onClick={() => setNumVersions(n)} style={{ flex: 1, padding: "8px 0", borderRadius: 9, border: `2px solid ${numVersions === n ? gv.color : "#EEE"}`, background: numVersions === n ? gv.light : "white", color: numVersions === n ? gv.color : "#888", fontFamily: FF, fontSize: 15, cursor: "pointer", transition: "all 0.15s" }}>{VERSION_LABELS[n-1]}</button>
                ))}
              </div>
              <p style={{ fontFamily: F, fontSize: 11, color: "#AAA", margin: "6px 0 0" }}>Versions are labeled A, B, C, D</p>
            </div>
            <div>
              <label style={{ ...LBL, marginTop: 0 }}>Options</label>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 6 }}>
                {[
                  [randomize, setRandomize, "Randomize question order"],
                  [keepFixed, setKeepFixed, "Keep instructions & passages fixed"],
                ].map(([val, set, lbl], i) => (
                  <label key={i} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
                    <div onClick={() => set(v => !v)} style={{ width: 36, height: 20, borderRadius: 10, background: val ? gv.color : "#CCC", position: "relative", transition: "background 0.2s", flexShrink: 0, cursor: "pointer" }}>
                      <div style={{ position: "absolute", top: 3, left: val ? 18 : 3, width: 14, height: 14, borderRadius: "50%", background: "white", transition: "left 0.2s" }} />
                    </div>
                    <span style={{ fontFamily: F, fontSize: 12.5, fontWeight: 700, color: val ? "#333" : "#AAA" }}>{lbl}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div style={{ background: gv.light, borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 24 }}>
            {[
              ["Total elements", ws.elements.length],
              ["Questions (randomized)", ws.elements.filter(isQuestion).length],
              ["Fixed elements", ws.elements.filter(e => !isQuestion(e)).length],
            ].map(([lbl, val]) => (
              <div key={lbl} style={{ textAlign: "center" }}>
                <div style={{ fontFamily: FF, fontSize: 22, color: gv.color }}>{val}</div>
                <div style={{ fontFamily: F, fontSize: 11, color: "#999", fontWeight: 700 }}>{lbl}</div>
              </div>
            ))}
          </div>

          {/* Version previews */}
          <label style={{ ...LBL, marginTop: 0 }}>Version Previews</label>
          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            {versions.map((els, vi) => (
              <button key={vi} onClick={() => setPreviewVer(previewVer === vi ? null : vi)}
                style={{ padding: "7px 14px", borderRadius: 9, border: `2px solid ${previewVer === vi ? gv.color : "#EEE"}`, background: previewVer === vi ? gv.light : "white", color: previewVer === vi ? gv.color : "#666", fontFamily: F, fontWeight: 800, fontSize: 13, cursor: "pointer", transition: "all 0.15s" }}>
                Version {VERSION_LABELS[vi]} {previewVer === vi ? "▲" : "▼"}
              </button>
            ))}
          </div>

          {previewVer !== null && (
            <div style={{ marginTop: 12, background: "#FAFAFA", borderRadius: 12, padding: "12px 16px", border: "2px solid #EEE", animation: "fadeIn 0.2s ease" }}>
              <p style={{ fontFamily: F, fontSize: 11, fontWeight: 900, color: gv.color, textTransform: "uppercase", margin: "0 0 8px" }}>Version {VERSION_LABELS[previewVer]} — Question Order</p>
              {versions[previewVer].filter(isQuestion).map((el, i) => (
                <div key={el.id} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 7 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "50%", background: gv.color, color: "white", fontFamily: F, fontWeight: 900, fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i+1}</span>
                  <span style={{ fontFamily: F, fontSize: 12.5, color: "#555", lineHeight: 1.4, paddingTop: 2 }}>
                    {el.type === "multipleChoice" ? el.question :
                     el.type === "truefalse" ? `True/False: ${(el.statements||[])[0]}…` :
                     el.type === "shortAnswer" ? el.question :
                     el.type === "fillBlank" ? el.text?.slice(0,60)+"…" :
                     el.type === "blank" ? el.label :
                     el.type === "matching" ? el.title || "Matching activity" : el.type}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "14px 24px", borderTop: "2px solid #F0F0F0", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Btn onClick={onClose} bg="#F2F2F2" xs={{ color: "#666" }}>Cancel</Btn>
          <button onClick={printVersions} style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: gv.color, color: "white", fontFamily: FF, fontSize: 15, cursor: "pointer", boxShadow: `0 3px 12px ${gv.color}55` }}>
            🖨️ Print All {numVersions} Version{numVersions > 1 ? "s" : ""}
          </button>
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ExportModal({ gv, ws, onClose }) {
  const [copied, setCopied] = useState(false);

  // Build plain-text export
  const toText = () => {
    const totalPages = Math.max(1, ws.pageCount || 1);
    const lines = [`${ws.title}`, "=".repeat(ws.title.length), ""];
    if (ws.showName) lines.push("Name: _______________________________   ");
    if (ws.showDate) lines.push("Date: _______________________________");
    lines.push("");
    const renderEl = (el, i) => {
      if (el.type === "instruction") { lines.push(`[Instructions]`); lines.push(el.text || ""); lines.push(""); }
      else if (el.type === "text") { lines.push(el.text || ""); lines.push(""); }
      else if (el.type === "multipleChoice") {
        lines.push(`${i+1}. ${el.question}`);
        (el.choices||[]).forEach(c => lines.push(`   ○ ${c}`));
        lines.push("");
      }
      else if (el.type === "truefalse") {
        lines.push("True or False? Circle your answer.");
        (el.statements||[]).forEach((s, j) => lines.push(`${j+1}. ${s}    TRUE / FALSE`));
        lines.push("");
      }
      else if (el.type === "shortAnswer") { lines.push(el.question||""); lines.push("_".repeat(60)); lines.push(""); }
      else if (el.type === "fillBlank") { lines.push(el.text||""); lines.push(""); }
      else if (el.type === "blank") { lines.push(el.label||""); lines.push("_".repeat(60)); lines.push(""); }
      else if (el.type === "essay") { lines.push(el.prompt||""); lines.push("_".repeat(60)+"\n".repeat(6)); lines.push(""); }
      else if (el.type === "wordBank") { lines.push(`[${el.title||"Word Bank"}]`); lines.push((el.words||[]).join("   ")); lines.push(""); }
      else if (el.type === "matching") {
        lines.push(el.title||"Match the following:");
        (el.left||[]).forEach((item, j) => lines.push(`${item}  ──  ${(el.right||[])[j]||"______"}`));
        lines.push("");
      }
      else if (el.type === "successCriteria" || el.type === "exitTicket") {
        if (el.title) lines.push(el.title);
        if (el.intro) lines.push(el.intro);
        (el.items||[]).forEach(item => lines.push(`[ ] ${item}`));
        lines.push("");
      }
      else if (el.type === "dokQuestions") {
        if (el.title) lines.push(el.title);
        if (el.intro) lines.push(el.intro);
        (el.levels||[]).forEach(lv => {
          lines.push(`-- DOK ${lv.level} · ${lv.label} --`);
          (lv.items||[]).forEach(q => lines.push(`[ ] ${q}`));
        });
        lines.push("");
      }
      else if (el.type === "divider") { lines.push("─".repeat(40)); lines.push(""); }
    };
    for (let p = 0; p < totalPages; p++) {
      if (totalPages > 1) { lines.push(`──── Page ${p + 1} ────`); lines.push(""); }
      const pageEls = ws.elements.filter(e => Math.min(totalPages - 1, e.page || 0) === p);
      pageEls.forEach((el, i) => renderEl(el, i));
      if (p < totalPages - 1) { lines.push("\f"); lines.push(""); }
    }
    // Standards Citations section
    const stds = ws.standards || [];
    if (stds.length > 0) {
      lines.push("");
      lines.push("═══════════════════════════════════════");
      lines.push("STANDARDS CITATIONS");
      lines.push("═══════════════════════════════════════");
      lines.push("Aligned to the New York State Next Generation Learning Standards.");
      lines.push("");
      stds.forEach(s => {
        lines.push(`• ${s.code}: ${s.desc}`);
        // Show items aligned to this standard
        const aligned = (ws.elements || [])
          .map((el, i) => ({ el, i }))
          .filter(({ el }) => (el.stdCodes || []).includes(s.code));
        if (aligned.length) {
          aligned.forEach(({ el, i }) => lines.push(`     ↳ Item ${i + 1} (${el.type})`));
        }
        lines.push("");
      });
    }
    return lines.join("\n");
  };

  // Build full HTML export
  const toHTML = () => {
    const gv2 = gInfo(ws.gradeId);
    const renderEl = (el) => {
      const fs = gv2.fontSize;
      const mb = (s) => inlineMarkdownToHtml(s || "");
      if (el.type === "instruction") return `<div style="background:#FFFACD;padding:10px 16px;border-radius:10px;border-left:6px solid ${gv2.color};margin-bottom:16px;font-size:${Math.max(fs-7,13)}px;font-weight:700;line-height:1.55">${mb(el.text)}</div>`;
      if (el.type === "text") return `<p style="font-size:${fs}px;font-weight:600;margin:0 0 16px;line-height:1.7">${mb(el.text)}</p>`;
      if (el.type === "image" && el.url) return `<div style="text-align:${el.align||"center"};margin-bottom:16px"><img src="${el.url}" style="max-width:${el.size==="small"?"35%":el.size==="large"?"95%":"65%"};border-radius:10px;border:2px solid #EEE">${el.caption?`<p style="font-size:12px;color:#777;text-align:center;margin:6px 0 0">${el.caption}</p>`:""}</div>`;
      if (el.type === "multipleChoice") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 10px">${mb(el.question)}</p>${(el.choices||[]).map(c=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:50%;border:2.5px solid ${gv2.color};flex-shrink:0"></div><span style="font-size:${fs}px">${mb(c)}</span></div>`).join("")}</div>`;
      if (el.type === "truefalse") return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs-5,13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">True or False? Circle your answer.</p>${(el.statements||[]).map(s=>`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:8px 12px;background:${gv2.light};border-radius:8px"><span style="font-size:${fs}px">${mb(s)}</span><span style="font-size:12px;font-weight:900;color:${gv2.color};margin-left:20px;white-space:nowrap">TRUE &nbsp;&nbsp; FALSE</span></div>`).join("")}</div>`;
      if (el.type === "shortAnswer") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.question)}</p>${Array.from({length:el.lines||4}).map(()=>`<div style="height:${gv2.lineH*0.9}px;border-bottom:2px solid #CCC;margin-bottom:6px"></div>`).join("")}</div>`;
      if (el.type === "fillBlank") return `<div style="margin-bottom:18px">${el.note?`<p style="font-size:12px;color:#999;margin:0 0 6px">${mb(el.note)}</p>`:""}<p style="font-size:${fs}px;line-height:1.9;margin:0">${(el.text||"").split("______").map((p,i,a)=>i<a.length-1?`${mb(p)}<span style="display:inline-block;width:90px;border-bottom:2.5px solid ${gv2.color};vertical-align:bottom;margin:0 3px"></span>`:mb(p)).join("")}</p></div>`;
      if (el.type === "blank") return `<div style="margin-bottom:18px">${el.label?`<p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.label)}</p>`:""} ${Array.from({length:el.lines||3}).map(()=>`<div style="height:${gv2.lineH}px;border-bottom:2.5px solid #CCC;margin-bottom:8px"></div>`).join("")}</div>`;
      if (el.type === "wordBank") return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs-4,13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">${el.title||"Word Bank"}</p><div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${gv2.light};border-radius:10px">${(el.words||[]).map(w=>`<span style="font-size:${fs}px;padding:4px 12px;border:2px solid ${gv2.color};border-radius:50px;background:white">${mb(w)}</span>`).join("")}</div></div>`;
      if (el.type === "matching") return `<div style="margin-bottom:18px">${el.title?`<p style="font-size:${Math.max(fs-4,13)}px;font-weight:800;margin:0 0 12px">${mb(el.title)}</p>`:""}<table style="width:100%;border-collapse:collapse"><tbody>${(el.left||[]).map((item,i)=>`<tr><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb(item)}</td><td style="text-align:center;padding:0 8px">—</td><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${mb((el.right||[])[i]||"")}</td></tr>`).join("")}</tbody></table></div>`;
      if (el.type === "essay") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${mb(el.prompt)}</p>${Array.from({length:el.lines||14}).map(()=>`<div style="height:${gv2.lineH*0.75}px;border-bottom:1.5px solid #DDD;margin-bottom:4px"></div>`).join("")}</div>`;
      if (el.type === "divider") return `<div style="margin:8px 0;text-align:center;color:${gv2.color};font-size:16px">✦</div>`;
      if (el.type === "table") return `<div style="margin-bottom:18px">${el.title?`<p style="font-size:${Math.max(fs-4,13)}px;font-weight:800;margin:0 0 10px">${mb(el.title)}</p>`:""}<table style="width:100%;border-collapse:collapse;font-size:${Math.max(fs-4,12)}px"><thead><tr>${(el.headers||[]).map(h=>`<th style="padding:8px 12px;border:2px solid ${gv2.color};background:${gv2.color};color:white;font-weight:900;text-align:center">${mb(h)}</th>`).join("")}</tr></thead><tbody>${(el.rows||[]).map(row=>`<tr>${(row||[]).map(cell=>`<td style="padding:6px 10px;border:1.5px solid #DDD;height:${gv2.lineH}px;vertical-align:top">${mb(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      if (el.type === "successCriteria" || el.type === "exitTicket") {
        const a = el.type === "successCriteria" ? gv2.color : "#0369A1";
        const bg2 = el.type === "successCriteria" ? gv2.light : "#EFF6FF";
        return `<div style="margin-bottom:18px;background:${bg2};border:2px solid ${a}45;border-left:6px solid ${a};border-radius:10px;padding:12px 16px">${el.title?`<p style="font-size:${Math.max(fs-2,13)}px;font-weight:900;color:${a};margin:0 0 6px">${el.title}</p>`:""}${el.intro?`<p style="font-size:${Math.max(fs-4,11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>`:""}<ul style="list-style:none;padding:0;margin:0">${(el.items||[]).map(item=>`<li style="display:flex;align-items:flex-start;gap:10px;margin-bottom:8px"><span style="flex-shrink:0;display:inline-block;width:18px;height:18px;margin-top:2px;border:2px solid ${a};border-radius:4px;background:white"></span><span style="font-size:${fs}px;font-weight:600;color:#111827;line-height:1.45">${mb(item)}</span></li>`).join("")}</ul></div>`;
      }
      if (el.type === "dokQuestions") {
        const LC = ["#10B981","#0EA5E9","#8B5CF6","#F59E0B"];
        return `<div style="margin-bottom:18px;background:#FFFFFF;border:2px solid ${gv2.color}45;border-left:6px solid ${gv2.color};border-radius:10px;padding:12px 16px">${el.title?`<p style="font-size:${Math.max(fs-2,13)}px;font-weight:900;color:${gv2.color};margin:0 0 6px">${el.title}</p>`:""}${el.intro?`<p style="font-size:${Math.max(fs-4,11)}px;font-weight:600;color:#374151;margin:0 0 10px;line-height:1.5">${mb(el.intro)}</p>`:""}${(el.levels||[]).map((lv,li)=>{const c=LC[(lv.level||li+1)-1]||gv2.color;return `<div style="background:${c}10;border:1.5px solid ${c}55;border-radius:8px;padding:8px 10px;margin-bottom:8px"><p style="font-size:${Math.max(fs-4,11)}px;font-weight:900;color:${c};margin:0 0 6px">DOK ${lv.level} · ${lv.label}</p><ul style="list-style:none;padding:0;margin:0">${(lv.items||[]).map(q=>`<li style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px"><span style="flex-shrink:0;display:inline-block;width:16px;height:16px;margin-top:2px;border:2px solid ${c};border-radius:3px;background:white"></span><span style="font-size:${Math.max(fs-1,12)}px;font-weight:600;color:#111827;line-height:1.45">${mb(q)}</span></li>`).join("")}</ul></div>`}).join("")}</div>`;
      }
      return "";
    };
    const totalPages = Math.max(1, ws.pageCount || 1);
    const hidden = new Set(ws.pageHeadersHidden || []);
    const pagesHtml = Array.from({ length: totalPages }).map((_, pIdx) => {
      const pageEls = ws.elements.filter(e => Math.min(totalPages - 1, e.page || 0) === pIdx);
      const isLast = pIdx === totalPages - 1;
      const hideHeader = hidden.has(pIdx);
      const headerHtml = hideHeader ? "" : `<div style="border-bottom:3px solid ${gv2.color}25;padding-bottom:8px;margin-bottom:16px"><h1 style="font-family:'Fredoka One',cursive;color:${gv2.color};font-size:${gv2.fontSize+6}px;margin:0 0 14px;padding-right:120px">${ws.title}${totalPages > 1 ? ` <span style="font-family:'Nunito',sans-serif;font-size:${Math.max(gv2.fontSize-4,12)}px;font-weight:700;color:#9CA3AF">— Page ${pIdx + 1}</span>` : ""}</h1><div style="display:flex;gap:44px">${ws.showName?`<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize-10,12)}px">Name:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>`:""} ${ws.showDate?`<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize-10,12)}px">Date:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>`:""}</div></div>`;
      return `<div class="ws-page" style="max-width:760px;margin:0 auto;padding:52px 64px;font-family:'Nunito',sans-serif;position:relative;${isLast ? "" : "page-break-after:always;"}">${ws.showGrade?`<div style="position:absolute;top:14px;right:18px;background:${gv2.light};border:2px solid ${gv2.color}40;border-radius:20px;padding:3px 13px;font-size:11px;font-weight:900;color:${gv2.color}">${gv2.emoji} ${gv2.name}</div>`:""}${headerHtml}${pageEls.map(renderEl).join("")}</div>`;
    }).join("");

    // Standards Citations page
    const safe = (s) => String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const stds = ws.standards || [];
    let citationsHtml = "";
    if (stds.length > 0) {
      const items = stds.map(s => {
        const aligned = (ws.elements || [])
          .map((el, i) => ({ el, i }))
          .filter(({ el }) => (el.stdCodes || []).includes(s.code));
        const alignedHtml = aligned.length
          ? `<div style="margin-top:6px;padding-left:14px;font-size:12px;color:#555">Aligned items: ${aligned.map(({ i }) => `#${i + 1}`).join(", ")}</div>`
          : "";
        return `<li style="margin-bottom:14px;line-height:1.55"><strong style="color:${gv2.color}">${safe(s.code)}</strong> — ${safe(s.desc)}${alignedHtml}</li>`;
      }).join("");
      citationsHtml = `<div class="ws-page" style="max-width:760px;margin:0 auto;padding:52px 64px;font-family:'Nunito',sans-serif">
        <h2 style="font-family:'Fredoka One',cursive;color:${gv2.color};font-size:${gv2.fontSize+4}px;margin:0 0 6px;border-bottom:3px solid ${gv2.color}25;padding-bottom:8px">📚 Standards Citations</h2>
        <p style="font-size:12.5px;color:#666;margin:0 0 16px">Aligned to the New York State Next Generation Learning Standards.</p>
        <ul style="padding-left:18px;margin:0;font-size:13.5px;color:#222">${items}</ul>
      </div>`;
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ws.title}</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;font-family:'Nunito',sans-serif}@media print{body{margin:0}.ws-page{page-break-after:always}.ws-page:last-child{page-break-after:auto}}</style></head><body>${pagesHtml}${citationsHtml}</body></html>`;
  };

  const downloadHTML = () => {
    const html = toHTML();
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ws.title.replace(/\s+/g, "_") || "worksheet"}.html`;
    a.click();
  };

  const downloadTXT = () => {
    const txt = toText();
    const blob = new Blob([txt], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${ws.title.replace(/\s+/g, "_") || "worksheet"}.txt`;
    a.click();
  };

  const copyText = () => {
    navigator.clipboard.writeText(toText()).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const openPrintPreview = () => {
    const w = window.open("", "_blank");
    w.document.write(toHTML());
    w.document.close();
    setTimeout(() => w.print(), 500);
  };

  const exports = [
    { icon: "🖨️", label: "Print / Save as PDF", desc: "Opens a clean print-ready preview. Choose 'Save as PDF' in your print dialog.", action: openPrintPreview, color: gv.color, primary: true },
    { icon: "🌐", label: "Download as HTML", desc: "A self-contained webpage you can open in any browser or share online.", action: downloadHTML, color: "#3B6FE8" },
    { icon: "📄", label: "Download as .TXT", desc: "Plain text format — easy to paste into Google Docs, Word, or any editor.", action: downloadTXT, color: "#0FAB8C" },
    { icon: "📋", label: "Copy as Text", desc: copied ? "✅ Copied to clipboard!" : "Copies the full worksheet as plain text to your clipboard.", action: copyText, color: "#888" },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 18, maxWidth: 520, width: "100%", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "fadeIn 0.25s ease" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 14px", borderBottom: "2px solid #F0F0F0", background: gv.light, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>📤 Export Worksheet</h2>
            <p style={{ margin: "5px 0 0", fontSize: 12, color: "#999", fontFamily: F }}>Choose how you'd like to save or share this worksheet.</p>
          </div>
          <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16, color: "#888", fontWeight: 800 }}>✕</button>
        </div>
        <div style={{ padding: "18px 24px 24px", display: "flex", flexDirection: "column", gap: 10 }}>
          {exports.map(ex => (
            <button key={ex.label} onClick={ex.action}
              style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px", borderRadius: 12, border: `2px solid ${ex.primary ? ex.color : "#EEE"}`, background: ex.primary ? ex.color : "white", cursor: "pointer", textAlign: "left", transition: "all 0.15s" }}
              onMouseEnter={e => { if (!ex.primary) { e.currentTarget.style.borderColor = ex.color; e.currentTarget.style.background = "#F8F8FF"; } }}
              onMouseLeave={e => { if (!ex.primary) { e.currentTarget.style.borderColor = "#EEE"; e.currentTarget.style.background = "white"; } }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{ex.icon}</span>
              <div>
                <div style={{ fontFamily: F, fontWeight: 900, fontSize: 14, color: ex.primary ? "white" : "#222", marginBottom: 3 }}>{ex.label}</div>
                <div style={{ fontFamily: F, fontSize: 12, color: ex.primary ? "rgba(255,255,255,0.8)" : "#999", lineHeight: 1.4 }}>{ex.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// HELP MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function HelpModal({ onClose, gv }) {
  const secs = [
    { icon:"🎯", title:"Getting Started", body:"1. Select the grade level from the dropdown in the top bar — Pre-K through Grade 12.\n2. Type your worksheet title.\n3. Add elements from the LEFT panel (click the + buttons).\n4. Click any element on the worksheet to edit it in the right panel.\n5. Use the tabs on the right for Editing, AI Images, and AI Help.\n6. Click PRINT to print or save as PDF." },
    { icon:"📊", title:"Grade Levels", body:"Font size and spacing scale automatically by grade:\n🌱 Pre-K: 38pt  •  K: 32pt  •  Gr 1: 28pt  •  Gr 2: 24pt\n⭐ Gr 3: 22pt  •  Gr 4: 20pt  •  Gr 5: 18pt\n🏫 Gr 6: 17pt  •  Gr 7: 16pt  •  Gr 8: 15pt\n🎓 Grades 9–12: 14pt (standard print size)\nColor themes change by grade band automatically." },
    { icon:"🗽", title:"NY Standards Picker", body:"Click '🗽 NY Standards' in the left panel to browse New York State standards. Filter by Subject (ELA, Math, Science, Social Studies, Health, Arts, Technology) and Grade Band. Search by keyword. Click any standard to add it as a header at the top of your worksheet." },
    { icon:"🎨", title:"AI Image Generator", body:"Click the '🎨 Image' tab on the right. Type a description of the image you need — for example: 'a cartoon frog sitting on a lily pad' or 'a diagram of the water cycle'. Choose a style: Cartoon, Photograph, Line Art, Clipart, or Diagram. Click Generate. When your image appears, click '➕ Add to Worksheet'.\n\nNote: Generation takes 10–20 seconds. Click Regenerate for a new variation." },
    { icon:"📎", title:"Reference Upload", body:"In the left panel under 'Reference Worksheet', click the upload area and select a photo or screenshot of a worksheet you want to recreate or draw inspiration from. The AI will analyze it automatically. Then go to the AI Help tab and ask: 'Help me build a worksheet similar to my reference' — and it will use that context!" },
    { icon:"🖨️", title:"Printing & Saving as PDF", body:"Click the PRINT button in the top bar. In the print dialog, choose 'Save as PDF' to create a PDF file. All panels and editing UI disappear when printing — only your clean worksheet appears. The grade level badge is printed on the worksheet." },
  ];

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 18, maxWidth: 660, width: "100%", maxHeight: "88vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", animation: "fadeIn 0.25s ease" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 14px", borderBottom: "2px solid #F0F0F0", background: gv.light, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>📖 How to Use WorksheetBuilder</h2>
          <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16, color: "#888", fontWeight: 800 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "18px 24px 28px" }}>
          {secs.map((s, i) => (
            <div key={i} style={{ marginBottom: 22, paddingBottom: 22, borderBottom: i < secs.length - 1 ? "1px solid #F0F0F0" : "none" }}>
              <h3 style={{ fontFamily: FF, color: gv.color, margin: "0 0 8px 0", fontSize: 16 }}>{s.icon} {s.title}</h3>
              <p style={{ fontFamily: F, fontSize: 13.5, color: "#444", lineHeight: 1.65, margin: 0, whiteSpace: "pre-wrap" }}>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ALIGNMENT MODAL — shows which standard each question/activity maps to
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function elSummary(el, idx) {
  const n = `${idx + 1}.`;
  if (!el) return n;
  if (el.type === "instruction") return `${n} 📋 Directions — ${(el.text || "").slice(0, 70)}`;
  if (el.type === "text")        return `${n} 📄 Passage — ${(el.text || "").slice(0, 70)}`;
  if (el.type === "multipleChoice") return `${n} 🔘 MC — ${(el.question || "").slice(0, 70)}`;
  if (el.type === "truefalse")   return `${n} ✅ True/False (${(el.statements||[]).length} items)`;
  if (el.type === "shortAnswer") return `${n} ✍️ Short Answer — ${(el.question || "").slice(0, 70)}`;
  if (el.type === "fillBlank")   return `${n} ✏️ Fill-in — ${(el.text || "").slice(0, 70)}`;
  if (el.type === "blank")       return `${n} 📝 Response — ${(el.label || "").slice(0, 70)}`;
  if (el.type === "essay")       return `${n} 📖 Essay — ${(el.prompt || "").slice(0, 70)}`;
  if (el.type === "matching")    return `${n} 🔗 Matching — ${(el.title || "")}`;
  if (el.type === "wordBank")    return `${n} 📚 ${el.title || "Word Bank"}`;
  if (el.type === "successCriteria") return `${n} 🎯 Success Criteria`;
  if (el.type === "exitTicket")  return `${n} 🎟️ Exit Ticket`;
  if (el.type === "dokQuestions") return `${n} 🧠 DOK Questions`;
  if (el.type === "image")       return `${n} 🖼️ Image`;
  if (el.type === "table")       return `${n} 📊 Table`;
  if (el.type === "divider")     return `${n} ─── Divider`;
  return `${n} ${el.type}`;
}

function AlignmentModal({ gv, ws, onClose, onSetMapping }) {
  const standards = ws.standards || [];
  const items = (ws.elements || []).filter(e => !["divider"].includes(e.type));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "white", borderRadius: 18, maxWidth: 760, width: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: "20px 24px 14px", borderBottom: "2px solid #F0F0F0", background: gv.light, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ margin: 0, fontFamily: FF, color: gv.color, fontSize: 22 }}>🎯 Standards Alignment</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#666", fontFamily: F }}>See which NYS standard each worksheet item maps to. Click a standard chip to assign or remove it.</p>
          </div>
          <button onClick={onClose} style={{ background: "white", border: "none", borderRadius: "50%", width: 34, height: 34, cursor: "pointer", fontSize: 16, color: "#888", fontWeight: 800 }}>✕</button>
        </div>

        <div style={{ overflowY: "auto", padding: "16px 24px 22px" }}>
          {standards.length === 0 && (
            <div style={{ padding: 16, background: "#FFF7ED", border: "1.5px dashed #FDBA74", borderRadius: 10, fontFamily: F, fontSize: 13, color: "#9A3412", marginBottom: 14 }}>
              No standards have been added yet. Use the <strong>🗽 NY Standards</strong> button in the left panel to add one or more standards. Items will then map to those standards here.
            </div>
          )}

          {standards.length > 0 && (
            <>
              <div style={{ marginBottom: 16 }}>
                <p style={{ ...LBL, marginTop: 0 }}>Cited Standards ({standards.length})</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {standards.map(s => (
                    <span key={s.code} title={s.desc} style={{ padding: "4px 10px", borderRadius: 14, background: gv.light, border: `1.5px solid ${gv.color}`, color: gv.color, fontFamily: F, fontSize: 11.5, fontWeight: 800 }}>{s.code}</span>
                  ))}
                </div>
              </div>

              <p style={{ ...LBL, marginTop: 0 }}>Item-by-Item Mapping</p>
              {items.map((el, i) => {
                const mapped = el.stdCodes || [];
                return (
                  <div key={el.id} style={{ padding: "10px 12px", border: "1.5px solid #EEE", borderRadius: 10, marginBottom: 8, background: mapped.length ? "white" : "#FAFAFA" }}>
                    <div style={{ fontFamily: F, fontSize: 12.5, color: "#374151", marginBottom: 6, lineHeight: 1.4 }}>{elSummary(el, i)}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {standards.map(s => {
                        const on = mapped.includes(s.code);
                        return (
                          <button key={s.code} onClick={() => {
                            const next = on ? mapped.filter(c => c !== s.code) : [...mapped, s.code];
                            onSetMapping(el.id, next);
                          }} style={{ padding: "3px 9px", borderRadius: 12, border: `1.5px solid ${on ? gv.color : "#DDD"}`, background: on ? gv.color : "white", color: on ? "white" : "#666", fontFamily: F, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            {on ? "✓ " : ""}{s.code}
                          </button>
                        );
                      })}
                      {mapped.length === 0 && <span style={{ fontFamily: F, fontSize: 11, color: "#9CA3AF", padding: "3px 4px" }}>Unaligned</span>}
                    </div>
                  </div>
                );
              })}
              {items.length === 0 && <p style={{ fontFamily: F, color: "#9CA3AF", fontSize: 13, textAlign: "center", padding: 20 }}>No items on the worksheet yet.</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export {
  BANDS, GRADES, gInfo, NY_STANDARDS, IMG_STYLES, PALETTE, uid, COLS, COL_GAP_PCT, COL_W_PCT, ROW_HEIGHT, nextSlot, mkEl, PRINT_CSS, F, FF, WORKSHEET_FONTS, Btn, LBL, INP, SHAPE_TYPES, ShapeSVG, BASELINE_WIDTH_PCT, BASELINE_HEIGHT_PX, SCALE_MIN, SCALE_MAX, clampScale, resizeScaleFor, ScaledContent, ElView, ElEditor, DOK_LEVEL_DEFS, DokEditor, ChecklistEditor, CustomShapeEditor, gradeIdToStdBand, StandardsModal, VERSION_LABELS, shuffle, isQuestion, VersionsModal, ExportModal, HelpModal, elSummary, AlignmentModal
};
