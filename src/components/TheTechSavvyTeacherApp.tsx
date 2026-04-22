// @ts-nocheck
/* eslint-disable */
import { useState, useRef, useEffect } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
    "Grades 9 – 12": [
      { code:"NY-AI.SSE.1",  desc:"Interpret expressions that represent a quantity in terms of its context — identify parts of an expression such as terms, factors, and coefficients (Algebra I)" },
      { code:"NY-AI.SSE.3",  desc:"Choose and produce an equivalent form of an expression to reveal and explain properties of the quantity represented by the expression (Algebra I)" },
      { code:"NY-AI.CED.1",  desc:"Create equations and inequalities in one variable to represent a real-world or mathematical problem; include equations arising from linear and quadratic functions (Algebra I)" },
      { code:"NY-AI.CED.2",  desc:"Create equations in two or more variables to represent relationships between quantities; graph equations on coordinate axes with appropriate labels and scales (Algebra I)" },
      { code:"NY-AI.REI.3",  desc:"Solve linear equations and inequalities in one variable, including equations with coefficients represented by letters (Algebra I)" },
      { code:"NY-AI.REI.4",  desc:"Solve quadratic equations in one variable by inspection, taking square roots, completing the square, or the quadratic formula (Algebra I)" },
      { code:"NY-AI.IF.4",   desc:"Interpret key features of graphs and tables for a function that models a relationship between two quantities — intercepts, intervals, maxima, minima (Algebra I)" },
      { code:"NY-AI.IF.7",   desc:"Graph functions expressed symbolically and show key features of the graph by hand and using technology (Algebra I)" },
      { code:"NY-AI.SP.3",   desc:"Interpret differences in shape, center, and spread in the context of the data sets; account for possible effects of extreme data points (Algebra I)" },
      { code:"NY-GEO.CO.9",  desc:"Prove theorems about lines and angles — vertical angles are congruent, alternate interior angles are congruent, and perpendicular bisector theorem (Geometry)" },
      { code:"NY-GEO.CO.10", desc:"Prove theorems about triangles — triangle angle sum, base angles of isosceles triangles, midsegment theorem (Geometry)" },
      { code:"NY-GEO.SRT.5", desc:"Use congruence and similarity criteria for triangles to solve problems and to prove relationships in geometric figures (Geometry)" },
      { code:"NY-GEO.C.5",   desc:"Derive using similarity the fact that the length of the arc intercepted by an angle is proportional to the radius; derive the formula for area of a sector (Geometry)" },
      { code:"NY-GEO.GPE.5", desc:"Prove the slope criteria for parallel and perpendicular lines; use them to solve geometric problems (Geometry)" },
      { code:"NY-AII.SSE.2", desc:"Use the structure of an expression to identify ways to rewrite it — factor polynomials, simplify rational expressions (Algebra II)" },
      { code:"NY-AII.APR.3", desc:"Identify zeros of polynomials when suitable factorizations are available; use the zeros to construct a rough graph of the function (Algebra II)" },
      { code:"NY-AII.FBF.1", desc:"Write a function that describes a relationship between two quantities including combining standard function types using arithmetic operations (Algebra II)" },
      { code:"NY-AII.IF.7",  desc:"Graph functions expressed symbolically including polynomial, rational, exponential, logarithmic, and trigonometric functions (Algebra II)" },
      { code:"NY-AII.SP.3",  desc:"Understand statistics as a process for making inferences about population parameters based on a random sample from that population (Algebra II)" },
    ],
  },
  "Science": {
    "Pre-K – 2": [
      { code:"NYSSCI.K-PS2-1",    desc:"Plan and conduct an investigation to compare effects of different pushes and pulls (K)" },
      { code:"NYSSCI.K-LS1-1",    desc:"Use observations to describe patterns of what plants and animals need to survive (K)" },
      { code:"NYSSCI.1-ESS1-1",   desc:"Use observations of the sun, moon, and stars to describe predictable patterns (Gr 1)" },
      { code:"NYSSCI.2-PS1-1",    desc:"Plan and conduct an investigation to describe and classify different kinds of materials (Gr 2)" },
      { code:"NYSSCI.2-LS2-1",    desc:"Investigate whether plants need sunlight and water to grow (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"NYSSCI.3-LS1-1",    desc:"Develop models to describe that organisms have unique and diverse life cycles (Gr 3)" },
      { code:"NYSSCI.3-PS2-1",    desc:"Provide evidence of the effects of balanced and unbalanced forces on motion (Gr 3)" },
      { code:"NYSSCI.4-ESS2-1",   desc:"Make observations to provide evidence of the effects of weathering and erosion (Gr 4)" },
      { code:"NYSSCI.5-PS1-1",    desc:"Develop a model to describe that matter is made of particles too small to be seen (Gr 5)" },
      { code:"NYSSCI.5-LS2-1",    desc:"Develop a model to describe movement of matter among plants, animals, and environment (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"NYSSCI.MS-PS1-2",   desc:"Analyze and interpret data on the properties of substances before and after interactions" },
      { code:"NYSSCI.MS-LS1-6",   desc:"Construct a scientific explanation for the role of photosynthesis in cycling of matter" },
      { code:"NYSSCI.MS-ESS2-1",  desc:"Develop a model to describe the cycling of Earth's materials and flow of energy" },
      { code:"NYSSCI.MS-ETS1-1",  desc:"Define the criteria and constraints of a design problem with sufficient precision to ensure a solution" },
    ],
    "Grades 9 – 12": [
      { code:"NYSSCI.HS-PS1-1",   desc:"Use the periodic table to predict relative properties of elements based on patterns" },
      { code:"NYSSCI.HS-LS1-1",   desc:"Construct an explanation for how DNA structure determines the structure of proteins" },
      { code:"NYSSCI.HS-ESS2-2",  desc:"Analyze geoscience data to make claims about feedbacks from one change to Earth's surface" },
      { code:"NYSSCI.HS-ETS1-1",  desc:"Analyze a major global challenge to specify qualitative and quantitative criteria for solutions" },
    ],
  },
  "Social Studies": {
    "Pre-K – 2": [
      { code:"NYSSS.PK.1",        desc:"Demonstrate understanding of self, family, and classroom community roles (Pre-K)" },
      { code:"NYSSS.K.1",         desc:"Understand community roles, responsibilities, and social interactions (K)" },
      { code:"NYSSS.1.1",         desc:"Understand family structures, traditions, and how they change over time (Gr 1)" },
      { code:"NYSSS.2.1",         desc:"Communities are made up of people with diverse cultural backgrounds (Gr 2)" },
    ],
    "Grades 3 – 5": [
      { code:"NYSSS.3.1",         desc:"Communities are shaped by their physical environment and geographic location (Gr 3)" },
      { code:"NYSSS.4.1",         desc:"The geography of New York State shaped the lives of people who settled here (Gr 4)" },
      { code:"NYSSS.4.3",         desc:"Colonial and Revolutionary New York: causes and effects of the American Revolution (Gr 4)" },
      { code:"NYSSS.5.1",         desc:"Western Hemisphere: Indigenous peoples, physical geography, and early European exploration (Gr 5)" },
    ],
    "Grades 6 – 8": [
      { code:"NYSSS.6.1",         desc:"Ancient civilizations: development of the earliest human communities and civilizations (Gr 6)" },
      { code:"NYSSS.7.2",         desc:"Early exploration, colonization, and the founding of the United States (Gr 7)" },
      { code:"NYSSS.7.4",         desc:"The Constitution and the new United States government (Gr 7)" },
      { code:"NYSSS.8.3",         desc:"Industrialization and progressive reform in the United States, 1870–1920 (Gr 8)" },
    ],
    "Grades 9 – 12": [
      { code:"NYSSS.9.2",         desc:"Political, social, and cultural change in the United States and the world (Gr 9)" },
      { code:"NYSSS.10.3",        desc:"Global industrialization and the rise of new economic and political systems (Gr 10)" },
      { code:"NYSSS.11.5",        desc:"The United States role in the Second World War and its aftermath (Gr 11)" },
      { code:"NYSSS.11.8",        desc:"Domestic and foreign policy after World War II through the Cold War era (Gr 11)" },
      { code:"NYSSS.12.G1",       desc:"Geographic reasoning: analyze the relationship between physical geography and human activity (Gr 12)" },
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

function ElView({ el, gv, selected, onClick, onResize, onDelete, onDragStart }) {
  // Per-element typography overrides
  const fs        = el.fontSizeOverride || gv.fontSize;
  const elFamily  = (el.fontFamily && el.fontFamily !== "default") ? el.fontFamily : "'Nunito', sans-serif";
  const elWeight  = el.bold ? 800 : undefined;
  const elStyle   = el.italic ? "italic" : undefined;
  const elDecor   = el.underline ? "underline" : undefined;
  const elAlign   = el.textAlign || undefined;

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
    boxSizing: "border-box",
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

  // ── 4-sided resize handles — shown when element is selected ──
  const ResizeHandles = () => !selected ? null : (
    <>
      {/* Bottom */}
      <div data-resize-handle onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onResize && onResize(e, el.id, "bottom"); }}
        style={{ position:"absolute", bottom:0, left:"50%", transform:"translateX(-50%)", width:48, height:14, cursor:"ns-resize", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}>
        <div style={{ width:36, height:4, borderRadius:2, background:gv.color+"90" }} />
      </div>
      {/* Top */}
      <div data-resize-handle onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onResize && onResize(e, el.id, "top"); }}
        style={{ position:"absolute", top:0, left:"50%", transform:"translateX(-50%)", width:48, height:14, cursor:"ns-resize", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}>
        <div style={{ width:36, height:4, borderRadius:2, background:gv.color+"90" }} />
      </div>
      {/* Right */}
      <div data-resize-handle onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onResize && onResize(e, el.id, "right"); }}
        style={{ position:"absolute", right:0, top:"50%", transform:"translateY(-50%)", width:14, height:48, cursor:"ew-resize", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}>
        <div style={{ width:4, height:36, borderRadius:2, background:gv.color+"90" }} />
      </div>
      {/* Left */}
      <div data-resize-handle onPointerDown={e => { e.preventDefault(); e.stopPropagation(); onResize && onResize(e, el.id, "left"); }}
        style={{ position:"absolute", left:0, top:"50%", transform:"translateY(-50%)", width:14, height:48, cursor:"ew-resize", zIndex:10, display:"flex", alignItems:"center", justifyContent:"center", touchAction:"none" }}>
        <div style={{ width:4, height:36, borderRadius:2, background:gv.color+"90" }} />
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

  if (el.type === "instruction") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Instructions element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      <div style={{ fontSize: Math.max(fs - 6, 12), fontWeight: elWeight || 600, color: "#1F2937", background: "#FEFCE8", padding: "10px 16px", borderRadius: 8, borderLeft: `5px solid ${gv.color}`, fontFamily: elFamily, lineHeight: 1.6, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{el.text}</div>
      <DeleteBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "text") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Text block — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      <p style={{ fontSize: fs, fontWeight: elWeight || 500, color: "#111827", margin: 0, fontFamily: elFamily, lineHeight: 1.75, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{el.text}</p>
      <DeleteBtn /><ResizeHandles />
    </div>
  );

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
    const containerStyle = floated ? { ...wrap, overflow: "hidden" } : { ...wrap, textAlign: el.align || "center" };
    const fillImgStyle = userSized && !floated
      ? { width: "100%", height: el.heightOverride ? (el.heightOverride - 28) + "px" : "auto", maxWidth: "100%", maxHeight: "none", objectFit: "contain", display: "block", borderRadius: 8, border: "1.5px solid #E5E7EB" }
      : { ...floatStyle, ...(!floated ? { maxWidth: imgMaxW } : {}), borderRadius: 8, border: "1.5px solid #E5E7EB", maxHeight: floated ? 200 : 360, objectFit: "contain", display: floated ? "block" : "inline-block" };
    return (
      <div className="ws-element" style={containerStyle} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Image element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
        {el.url ? (
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
        {!floated && el.caption && <p style={{ fontSize: Math.max(fs - 10, 11), color: "#6B7280", textAlign: "center", margin: "6px 0 0", fontFamily: F, fontWeight: 600 }}>{el.caption}</p>}
        {floated && <div style={{ clear: "both" }} />}
        <DeleteBtn /><ResizeHandles />
      </div>
    );
  }

  if (el.type === "blank") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Write lines element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      {el.label && <p style={{ fontSize: Math.max(fs - 3, 12), fontWeight: elWeight || 700, color: "#111827", margin: "0 0 10px 0", fontFamily: elFamily, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{el.label}</p>}
      {Array.from({ length: el.lines || 3 }).map((_, i) => <div key={i} aria-hidden="true" style={{ height: gv.lineH, borderBottom: "2px solid #D1D5DB", marginBottom: 6 }} />)}
      <DeleteBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "wordBank") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Word bank element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      <p style={{ fontSize: Math.max(fs - 4, 12), fontWeight: 700, color: gv.color, margin: "0 0 10px 0", fontFamily: FF, letterSpacing: 0.3 }}>{el.title}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, padding: "10px 14px", background: gv.light, borderRadius: 8, border: `1.5px solid ${gv.color}25` }}>
        {(el.words || []).map((w, i) => <span key={i} style={{ fontSize: fs, fontWeight: 600, fontFamily: elFamily, padding: "4px 14px", border: `1.5px solid ${gv.color}`, borderRadius: 40, background: "white", color: "#111827" }}>{w}</span>)}
      </div>
      <DeleteBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "matching") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Matching activity — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      {el.title && <p style={{ fontSize: Math.max(fs - 3, 12), fontWeight: elWeight || 700, color: "#111827", margin: "0 0 12px 0", fontFamily: elFamily }}>{el.title}</p>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", gap: 6, alignItems: "center" }}>
        {(el.left || []).map((item, i) => (
          <span key={i} style={{ display: "contents" }}>
            <div style={{ fontSize: fs, fontWeight: 600, fontFamily: elFamily, padding: "6px 10px", border: `1.5px solid ${gv.color}`, borderRadius: 8, background: gv.light, textAlign: "center" }}>{item}</div>
            <div aria-hidden="true" style={{ borderBottom: "1.5px dashed #9CA3AF", margin: "0 4px" }} />
            <div style={{ fontSize: fs, fontWeight: 600, fontFamily: elFamily, padding: "6px 10px", border: `1.5px solid ${gv.color}`, borderRadius: 8, background: gv.light, textAlign: "center" }}>{(el.right || [])[i] || ""}</div>
          </span>
        ))}
      </div>
      <DeleteBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "multipleChoice") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Multiple choice question — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      <p style={{ fontSize: fs, fontWeight: elWeight || 700, color: "#111827", margin: "0 0 5px 0", fontFamily: elFamily, lineHeight: 1.45, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{el.question}</p>
      {el.note && <p style={{ fontSize: Math.max(fs - 7, 11), fontWeight: 500, color: "#6B7280", margin: "0 0 12px 0", fontFamily: F }}>{el.note}</p>}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {(el.choices || []).map((c, i) => (
          <label key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div aria-hidden="true" style={{ width: Math.min(22, fs), height: Math.min(22, fs), borderRadius: "50%", border: `2px solid ${gv.color}`, flexShrink: 0, background: "white" }} />
            <span style={{ fontSize: fs, fontWeight: 500, fontFamily: elFamily }}>{c}</span>
          </label>
        ))}
      </div>
      <DeleteBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "truefalse") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="True or false activity — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      <p style={{ fontSize: Math.max(fs - 4, 12), fontWeight: 700, color: gv.color, margin: "0 0 10px 0", fontFamily: FF }}>True or False? Circle your answer.</p>
      {(el.statements || []).map((stmt, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10, padding: "8px 12px", background: gv.light, borderRadius: 8 }}>
          <span style={{ fontSize: fs, fontWeight: 500, fontFamily: elFamily, flex: 1, lineHeight: 1.45 }}>{stmt}</span>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {["TRUE", "FALSE"].map(t => <span key={t} aria-hidden="true" style={{ fontSize: Math.max(fs - 7, 10), fontWeight: 700, padding: "3px 10px", border: `1.5px solid ${gv.color}`, borderRadius: 40, fontFamily: F, color: gv.color }}>{t}</span>)}
          </div>
        </div>
      ))}
      <DeleteBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "shortAnswer") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Short answer question — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      <p style={{ fontSize: fs, fontWeight: elWeight || 700, color: "#111827", margin: "0 0 12px 0", fontFamily: elFamily, lineHeight: 1.45, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{el.question}</p>
      {Array.from({ length: el.lines || 4 }).map((_, i) => <div key={i} aria-hidden="true" style={{ height: gv.lineH * 0.9, borderBottom: "1.5px solid #D1D5DB", marginBottom: 5 }} />)}
      <DeleteBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "fillBlank") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Fill in the blank activity — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      {el.note && <p style={{ fontSize: Math.max(fs - 7, 11), fontWeight: 500, color: "#6B7280", margin: "0 0 8px 0", fontFamily: F }}>{el.note}</p>}
      <p style={{ fontSize: fs, fontWeight: elWeight || 500, color: "#111827", margin: 0, fontFamily: elFamily, lineHeight: 1.9, fontStyle: elStyle, textAlign: elAlign }}>
        {(el.text || "").split("______").map((part, i, arr) => (
          <span key={i}>{part}{i < arr.length - 1 && <span aria-label="blank" style={{ display: "inline-block", width: 85, borderBottom: `2px solid ${gv.color}`, verticalAlign: "bottom", margin: "0 3px" }} />}</span>
        ))}
      </p>
      <DeleteBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "essay") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Essay prompt — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <p style={{ fontSize: fs, fontWeight: elWeight || 700, color: "#111827", margin: 0, fontFamily: elFamily, lineHeight: 1.45, flex: 1, fontStyle: elStyle, textDecoration: elDecor, textAlign: elAlign }}>{el.prompt}</p>
        {el.points && <span style={{ fontSize: Math.max(fs - 6, 10), fontWeight: 700, color: gv.color, whiteSpace: "nowrap", marginLeft: 12, fontFamily: F, padding: "3px 9px", border: `1.5px solid ${gv.color}`, borderRadius: 40 }}>{el.points} pts</span>}
      </div>
      {Array.from({ length: el.lines || 14 }).map((_, i) => <div key={i} aria-hidden="true" style={{ height: gv.lineH * 0.75, borderBottom: "1px solid #E5E7EB", marginBottom: 3 }} />)}
      <DeleteBtn /><ResizeHandles />
    </div>
  );

  if (el.type === "table") return (
    <div className="ws-element" style={wrap} onPointerDown={handleMouseDown} onClick={onClick} role="button" tabIndex={0} aria-label="Table element — click to edit" onKeyDown={e => e.key === "Enter" && onClick()}>
      {el.title && <p style={{ fontSize: Math.max(fs - 3, 12), fontWeight: elWeight || 700, color: "#111827", margin: "0 0 8px 0", fontFamily: elFamily }}>{el.title}</p>}
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: Math.max(fs - 4, 11), fontFamily: elFamily }} role="table">
        <thead>
          <tr>{(el.headers || []).map((h, i) => <th key={i} scope="col" style={{ padding: "7px 10px", border: `1.5px solid ${gv.color}`, background: gv.color, color: "white", fontWeight: 700, textAlign: "center", fontFamily: F }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {(el.rows || []).map((row, ri) => (
            <tr key={ri}>{(row || []).map((cell, ci) => <td key={ci} style={{ padding: "5px 9px", border: "1px solid #D1D5DB", height: gv.lineH, verticalAlign: "top" }}>{cell || " "}</td>)}</tr>
          ))}
        </tbody>
      </table>
      <DeleteBtn /><ResizeHandles />
    </div>
  );

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
    const cols = colMap[el.layout] || 2;
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
        <DeleteBtn /><ResizeHandles />
      </div>
    );
  }

  return null;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ELEMENT EDITOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ElEditor({ el, gv, onChange, onDelete, onMoveUp, onMoveDown }) {
  const inp = { ...INP(), marginTop: 4 };
  if (!el) return (
    <div style={{ padding: 32, textAlign: "center", fontFamily: F, animation: "fadeIn 0.3s ease" }}>
      <div style={{ width: 52, height: 52, borderRadius: 12, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: 24 }}>✏️</div>
      <p style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.6, color: "#9CA3AF", margin: 0 }}>Select any element on the worksheet to edit its content and appearance here.</p>
    </div>
  );

  const paletteItem = PALETTE.find(p => p.type === el.type);

  // ── Typography section (shared by most text elements) ──
  const TypographySection = () => (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid #F3F4F6" }}>
      <p style={{ fontFamily: F, fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.8, margin: "0 0 10px 0" }}>Typography</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div>
          <label style={LBL}>Font Size (pt)</label>
          <input type="number" min={8} max={72} value={el.fontSizeOverride || ""} placeholder={`${gv.fontSize} (grade default)`}
            onChange={e => onChange({ fontSizeOverride: e.target.value ? parseInt(e.target.value) : null })}
            style={{ ...inp, marginTop: 4 }} aria-label="Override font size" />
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
          <button onClick={onDelete}   aria-label="Delete element"    style={{ padding: "4px 9px", borderRadius: 6, border: "1.5px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", fontFamily: F, fontSize: 13, color: "#DC2626" }}>Delete</button>
        </div>
      </div>

      {(el.type === "instruction" || el.type === "text") && (<>
        <label style={LBL}>Content</label>
        <textarea value={el.text} spellCheck onChange={e => onChange({ text: e.target.value })} style={{ ...inp, minHeight: 90, marginTop: 4 }} aria-label="Text content" />
        <TypographySection />
      </>)}

      {el.type === "image" && (<>
        <label style={LBL}>Image URL</label>
        <input type="url" value={el.url || ""} onChange={e => onChange({ url: e.target.value })} placeholder="https://…" style={{ ...inp, marginTop: 4 }} aria-label="Image URL" />
        <label style={LBL}>Upload from Device</label>
        <input type="file" accept="image/*" aria-label="Upload image file" onChange={e => { const f = e.target.files[0]; if (f) { const r = new FileReader(); r.onload = ev => onChange({ url: ev.target.result }); r.readAsDataURL(f); } }} style={{ ...inp, padding: 6, cursor: "pointer", marginTop: 4 }} />
        <label style={LBL}>Caption</label>
        <input type="text" value={el.caption || ""} spellCheck onChange={e => onChange({ caption: e.target.value })} placeholder="Optional caption…" style={{ ...inp, marginTop: 4 }} aria-label="Image caption" />
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
      </>)}

      {el.type === "blank" && (<>
        <label style={LBL}>Label / Question</label>
        <input type="text" value={el.label || ""} spellCheck onChange={e => onChange({ label: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Write lines label" />
        <label style={LBL}>Number of Lines</label>
        <input type="number" min={1} max={20} value={el.lines || 3} onChange={e => onChange({ lines: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...inp, marginTop: 4 }} aria-label="Number of lines" />
        <TypographySection />
      </>)}

      {el.type === "wordBank" && (<>
        <label style={LBL}>Title</label>
        <input type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Word bank title" />
        <label style={LBL}>Words (one per line)</label>
        <textarea value={(el.words || []).join("\n")} spellCheck onChange={e => onChange({ words: e.target.value.split("\n").map(w => w.trim()).filter(Boolean) })} style={{ ...inp, minHeight: 110, marginTop: 4 }} aria-label="Word bank words" />
      </>)}

      {el.type === "matching" && (<>
        <label style={LBL}>Title</label>
        <input type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Matching title" />
        <label style={LBL}>Left Column (one per line)</label>
        <textarea value={(el.left || []).join("\n")} spellCheck onChange={e => onChange({ left: e.target.value.split("\n").map(x => x.trim()).filter(Boolean) })} style={{ ...inp, minHeight: 80, marginTop: 4 }} aria-label="Left column items" />
        <label style={LBL}>Right Column (one per line)</label>
        <textarea value={(el.right || []).join("\n")} spellCheck onChange={e => onChange({ right: e.target.value.split("\n").map(x => x.trim()).filter(Boolean) })} style={{ ...inp, minHeight: 80, marginTop: 4 }} aria-label="Right column items" />
      </>)}

      {el.type === "multipleChoice" && (<>
        <label style={LBL}>Question</label>
        <input type="text" value={el.question || ""} spellCheck onChange={e => onChange({ question: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Question text" />
        <label style={LBL}>Instruction</label>
        <input type="text" value={el.note || ""} spellCheck onChange={e => onChange({ note: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Instruction note" />
        <label style={LBL}>Answer Choices (one per line)</label>
        <textarea value={(el.choices || []).join("\n")} spellCheck onChange={e => onChange({ choices: e.target.value.split("\n").map(c => c.trim()).filter(Boolean) })} style={{ ...inp, minHeight: 90, marginTop: 4 }} aria-label="Answer choices" />
        <TypographySection />
      </>)}

      {el.type === "truefalse" && (<>
        <label style={LBL}>Statements (one per line)</label>
        <textarea value={(el.statements || []).join("\n")} spellCheck onChange={e => onChange({ statements: e.target.value.split("\n").map(s => s.trim()).filter(Boolean) })} style={{ ...inp, minHeight: 120, marginTop: 4 }} aria-label="True/false statements" />
        <TypographySection />
      </>)}

      {el.type === "shortAnswer" && (<>
        <label style={LBL}>Question</label>
        <textarea value={el.question || ""} spellCheck onChange={e => onChange({ question: e.target.value })} style={{ ...inp, minHeight: 70, marginTop: 4 }} aria-label="Short answer question" />
        <label style={LBL}>Number of Lines</label>
        <input type="number" min={1} max={20} value={el.lines || 4} onChange={e => onChange({ lines: Math.max(1, parseInt(e.target.value) || 1) })} style={{ ...inp, marginTop: 4 }} aria-label="Number of answer lines" />
        <TypographySection />
      </>)}

      {el.type === "fillBlank" && (<>
        <label style={LBL}>Text (use <code style={{ background: "#F3F4F6", padding: "1px 4px", borderRadius: 3 }}>______</code> for blanks)</label>
        <textarea value={el.text || ""} spellCheck onChange={e => onChange({ text: e.target.value })} style={{ ...inp, minHeight: 80, marginTop: 4 }} placeholder="The ___ is blue." aria-label="Fill in the blank text" />
        <label style={LBL}>Hint / Note</label>
        <input type="text" value={el.note || ""} spellCheck onChange={e => onChange({ note: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Hint note" />
        <TypographySection />
      </>)}

      {el.type === "essay" && (<>
        <label style={LBL}>Essay Prompt</label>
        <textarea value={el.prompt || ""} spellCheck onChange={e => onChange({ prompt: e.target.value })} style={{ ...inp, minHeight: 90, marginTop: 4 }} aria-label="Essay prompt" />
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
        <input type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop: 4 }} aria-label="Table title" />
        <label style={LBL}>Column Headers (one per line)</label>
        <textarea value={(el.headers || []).join("\n")} spellCheck onChange={e => onChange({ headers: e.target.value.split("\n").map(h => h.trim()).filter(Boolean) })} style={{ ...inp, minHeight: 60, marginTop: 4 }} aria-label="Column headers" />
        <label style={LBL}>Number of Rows</label>
        <input type="number" min={1} max={20} value={(el.rows || []).length || 3}
          onChange={e => { const n = Math.max(1, parseInt(e.target.value) || 1); const cols = (el.headers || []).length || 3; onChange({ rows: Array.from({ length: n }, (_, i) => el.rows?.[i] || Array(cols).fill("")) }); }} style={{ ...inp, marginTop: 4 }} aria-label="Number of rows" />
      </>)}

      {el.type === "customShape" && <CustomShapeEditor el={el} onChange={onChange} gv={gv} inp={inp} />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CUSTOM SHAPE EDITOR
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

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
      <input type="text" value={el.title || ""} spellCheck onChange={e => onChange({ title: e.target.value })} style={{ ...inp, marginTop:4 }} aria-label="Shape group title" placeholder="Label each shape:" />

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
            <input type="text" value={active.label||""} spellCheck onChange={e => updShape(activeIdx, { label:e.target.value })} style={{ ...inp, marginTop:4 }} aria-label="Shape label" placeholder="e.g. Part A" />

            <label style={LBL}>Caption below shape</label>
            <input type="text" value={active.caption||""} spellCheck onChange={e => updShape(activeIdx, { caption:e.target.value })} style={{ ...inp, marginTop:4 }} aria-label="Caption below shape" placeholder="Optional description" />

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
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AIImageGen({ gv, onAddImage }) {
  const [prompt, setPrompt]         = useState("");
  const [style, setStyle]           = useState("cartoon");
  // 2 slots: null | { url, loading, error, errMsg }
  const [slots, setSlots]           = useState([null, null]);
  const [selected, setSelected]     = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSugg, setLoadingSugg] = useState(false);
  const suggTimerRef = useRef(null);

  const anyLoading = slots.some(s => s?.loading);
  const hasResults = slots.some(s => s?.url || s?.error);
  const selSlot    = selected !== null ? slots[selected] : null;

  // ── Fetch one image from Lovable AI Gateway (Nano Banana) ──────────
  const fetchImage = async (promptText, styleKey, variationIdx) => {
    // Add a tiny variation hint so the two slots differ
    const variationHints = [
      "centered front-facing composition",
      "slightly different angle or perspective for variety",
    ];
    const hint = variationHints[variationIdx] || variationHints[0];
    const fullPrompt = `${promptText}. ${hint}.`;

    const res = await fetch("https://iaklmdnlwjgguhkixvio.supabase.co/functions/v1/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: fullPrompt, style: styleKey }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error || `API error ${res.status}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (!data.url) throw new Error("No image URL returned");
    return data.url; // data:image/...;base64,...
  };

  // ── Generate one slot (marks loading, calls API, updates slot) ───────
  const runSlot = async (slotIdx, promptText, styleKey) => {
    setSlots(prev => {
      const next = [...prev];
      next[slotIdx] = { url: null, loading: true, error: false, errMsg: "" };
      return next;
    });
    try {
      const url = await fetchImage(promptText, styleKey, slotIdx);
      setSlots(prev => {
        const next = [...prev];
        next[slotIdx] = { url, loading: false, error: false, errMsg: "" };
        return next;
      });
    } catch (e) {
      setSlots(prev => {
        const next = [...prev];
        next[slotIdx] = { url: null, loading: false, error: true, errMsg: e.message || "Unknown error" };
        return next;
      });
    }
  };

  // ── Generate both sequentially (avoids rate-limit collisions) ────────
  const generateBoth = async () => {
    if (!prompt.trim() || anyLoading) return;
    setSelected(null);
    setSlots([null, null]);
    const p = prompt.trim();
    const s = style;
    runSlot(0, p, s);
    await new Promise(r => setTimeout(r, 1200));
    runSlot(1, p, s);
  };

  // ── Regenerate one slot independently ────────────────────────────────
  const regenSlot = (i) => {
    if (anyLoading) return;
    if (selected === i) setSelected(null);
    runSlot(i, prompt.trim(), style);
  };

  // ── Debounced AI suggestions ─────────────────────────────────────────
  useEffect(() => {
    if (suggTimerRef.current) clearTimeout(suggTimerRef.current);
    const trimmed = prompt.trim();
    if (trimmed.length < 3) { setSuggestions([]); return; }
    suggTimerRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const res = await fetch("https://iaklmdnlwjgguhkixvio.supabase.co/functions/v1/anthropic-proxy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 200,
            system: "You suggest specific educational image descriptions for classroom worksheet illustrations. Respond with ONLY a JSON array of 5 short strings, each under 10 words. No markdown, no explanation, no preamble.",
            messages: [{ role: "user", content: `Teacher is typing: "${trimmed}"\nSuggest 5 specific educational image descriptions that complete or expand on this. JSON array only.` }]
          })
        });
        const d = await res.json();
        const raw = d.content?.map(b => b.text || "").join("") || "[]";
        const clean = raw.replace(/```[\w]*\n?/g, "").replace(/```/g, "").trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed)) setSuggestions(parsed.slice(0, 5));
      } catch { setSuggestions([]); }
      setLoadingSugg(false);
    }, 750);
    return () => clearTimeout(suggTimerRef.current);
  }, [prompt]);

  return (
    <div style={{ padding: "14px 16px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>

      {/* Header */}
      <div style={{ background: `linear-gradient(135deg, ${gv.color}18, ${gv.light})`, borderRadius: 12, padding: "12px 14px", border: `2px solid ${gv.color}25` }}>
        <p style={{ fontFamily: FF, color: gv.color, fontSize: 15, margin: "0 0 3px 0" }}>🎨 AI Image Generator</p>
        <p style={{ fontFamily: F, fontSize: 11.5, color: "#777", margin: 0, lineHeight: 1.5 }}>Describe an image — AI creates 2 photo-quality variations. Pick one to add to your worksheet.</p>
      </div>

      {/* Style picker */}
      <div>
        <label style={LBL}>Style</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5 }}>
          {[["cartoon","🎨 Cartoon"],["photo","📷 Photo"],["lineart","✏️ Line Art"],["clipart","🎭 Clipart"],["diagram","📐 Diagram"],["minimal","◻️ Minimal"]].map(([id, lbl]) => (
            <button key={id} onClick={() => setStyle(id)}
              style={{ padding: "4px 10px", borderRadius: 16, border: `2px solid ${style === id ? gv.color : "#E8E8E8"}`, background: style === id ? gv.light : "white", color: style === id ? gv.color : "#777", fontFamily: F, fontWeight: 800, fontSize: 11, cursor: "pointer", transition: "all 0.15s" }}>
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* Prompt + suggestions */}
      <div>
        <label style={LBL}>Describe Your Image</label>
        <textarea
          value={prompt}
          onChange={e => { setPrompt(e.target.value); setSelected(null); }}
          spellCheck
          placeholder="e.g., a friendly cartoon sun with a smiling face"
          style={{ width: "100%", padding: "9px 11px", borderRadius: 10, border: `2px solid ${gv.color}40`, fontSize: 13, fontFamily: F, minHeight: 60, resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }}
        />
        {/* Live suggestions */}
        {(suggestions.length > 0 || loadingSugg) && (
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {loadingSugg && suggestions.length === 0 && (
              <div style={{ fontFamily: F, fontSize: 11, color: "#CCC", padding: "2px 4px" }}>💡 Suggesting ideas…</div>
            )}
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => { setPrompt(s); setSuggestions([]); }}
                style={{ textAlign: "left", padding: "6px 11px", borderRadius: 9, border: `1.5px solid ${gv.color}30`, background: gv.light, color: "#444", fontFamily: F, fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.12s", lineHeight: 1.4 }}
                onMouseEnter={e => { e.currentTarget.style.background = gv.color; e.currentTarget.style.color = "white"; }}
                onMouseLeave={e => { e.currentTarget.style.background = gv.light; e.currentTarget.style.color = "#444"; }}>
                💡 {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Generate button */}
      <button onClick={generateBoth} disabled={!prompt.trim() || anyLoading}
        style={{ padding: "10px", borderRadius: 11, border: "none", background: !prompt.trim() || anyLoading ? "#CCC" : gv.color, color: "white", fontFamily: FF, fontSize: 14, cursor: !prompt.trim() || anyLoading ? "not-allowed" : "pointer", transition: "background 0.2s" }}>
        {anyLoading ? "✨  Generating…" : hasResults ? "🔄  Generate 2 New Images" : "✨  Generate 2 Images"}
      </button>

      {/* 2 slots side-by-side */}
      {(hasResults || anyLoading) && (
        <div>
          <label style={{ ...LBL, marginTop: 2 }}>{anyLoading ? "Generating…" : "Pick Your Favourite"}</label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
            {slots.map((slot, i) => {
              const isSel = selected === i;
              return (
                <div key={i}>
                  <div
                    onClick={() => slot?.url && !anyLoading && setSelected(isSel ? null : i)}
                    style={{ borderRadius: 10, border: `3px solid ${isSel ? gv.color : slot?.url ? "#D0D0D0" : "#EBEBEB"}`, background: "#F8F8F8", overflow: "hidden", cursor: slot?.url && !anyLoading ? "pointer" : "default", position: "relative", aspectRatio: "1/1", transition: "all 0.15s", transform: isSel ? "scale(1.02)" : "none", boxShadow: isSel ? `0 4px 18px ${gv.color}55` : "none" }}>

                    {slot?.loading && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
                        <div style={{ fontSize: 22, animation: "spin 1.6s linear infinite" }}>✨</div>
                        <span style={{ fontFamily: F, fontSize: 10, color: "#BBB", fontWeight: 700 }}>Generating…</span>
                      </div>
                    )}
                    {!slot && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 22, opacity: 0.15 }}>🖼️</span>
                      </div>
                    )}
                    {slot?.error && (
                      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 5, padding: 8 }}>
                        <span style={{ fontSize: 20 }}>⚠️</span>
                        <span style={{ fontFamily: F, fontSize: 10, color: "#BB4444", fontWeight: 700, textAlign: "center", lineHeight: 1.3 }}>Failed</span>
                        {slot.errMsg && <span style={{ fontFamily: F, fontSize: 9, color: "#CCC", textAlign: "center", lineHeight: 1.3 }}>{slot.errMsg.slice(0, 80)}</span>}
                      </div>
                    )}
                    {slot?.url && (
                      <img src={slot.url} alt={`Generated variation ${i + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    )}

                    <div style={{ position: "absolute", top: 5, left: 5, background: "rgba(255,255,255,0.9)", borderRadius: 5, padding: "1px 6px", fontFamily: F, fontSize: 10, fontWeight: 900, color: "#888", zIndex: 2 }}>{i + 1}</div>

                    {isSel && (
                      <div style={{ position: "absolute", top: 5, right: 5, width: 20, height: 20, borderRadius: "50%", background: gv.color, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3 }}>
                        <span style={{ color: "white", fontSize: 11, fontWeight: 900 }}>✓</span>
                      </div>
                    )}

                    {(slot?.url || slot?.error) && !anyLoading && (
                      <button
                        onClick={e => { e.stopPropagation(); regenSlot(i); }}
                        title="Generate a new version"
                        style={{ position: "absolute", bottom: 6, right: 6, width: 26, height: 26, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.92)", color: "#666", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 5px rgba(0,0,0,0.18)", zIndex: 3, transition: "transform 0.15s" }}
                        onMouseEnter={e => e.currentTarget.style.transform = "rotate(30deg) scale(1.15)"}
                        onMouseLeave={e => e.currentTarget.style.transform = "none"}>
                        🔄
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Full preview for selected */}
      {selSlot?.url && (
        <div style={{ animation: "fadeIn 0.2s ease" }}>
          <label style={{ ...LBL, marginTop: 2 }}>Preview — Image {selected + 1}</label>
          <div style={{ borderRadius: 12, overflow: "hidden", border: `3px solid ${gv.color}`, background: "white", marginTop: 5, marginBottom: 8 }}>
            <img src={selSlot.url} alt={`Selected variation ${selected + 1}`} style={{ width: "100%", height: "auto", display: "block" }} />
          </div>
          <button onClick={() => { onAddImage(selSlot.url); setSelected(null); }}
            style={{ width: "100%", padding: "10px", borderRadius: 11, border: "none", background: "#0FAB8C", color: "white", fontFamily: FF, fontSize: 14, cursor: "pointer", boxShadow: "0 3px 10px #0FAB8C44" }}>
            ➕ Add Image {selected + 1} to Worksheet
          </button>
        </div>
      )}

      <p style={{ fontFamily: F, fontSize: 10, color: "#CCC", textAlign: "center", margin: "0 0 2px" }}>Powered by Lovable AI · Nano Banana · print-ready</p>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AI CHAT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function AIChat({ gv, wsTitle, elCount, refDesc }) {
  const [msgs, setMsgs] = useState([
    { role: "assistant", content: `Hi! 👋 I'm your worksheet assistant!\n\nI can help with any grade level. Try asking:\n• "Write 5 true/false questions about the American Revolution"\n• "Give me a word bank about habitats for ${gv.name}"\n• "Create a short reading passage about fractions"\n• "Simplify this text for ${gv.name}: [paste text]"\n• "Suggest 4 multiple choice questions about volcanoes"` }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef();
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const next = [...msgs, userMsg];
    setMsgs(next); setInput(""); setLoading(true);
    try {
      const r = await fetch("https://iaklmdnlwjgguhkixvio.supabase.co/functions/v1/anthropic-proxy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `You are a warm, expert assistant for educators creating academic worksheets. The current worksheet targets ${gv.name} students (${BANDS[gv.band]?.label}). The worksheet is titled "${wsTitle}" and has ${elCount} elements so far.${refDesc ? `\n\nReference worksheet the teacher uploaded: ${refDesc}` : ""}

Your role:
- Generate ready-to-use worksheet content (questions, activities, word banks, matching pairs, passages)
- Suggest ideas appropriate for ${gv.name} cognitive level
- Help simplify or increase text complexity when requested
- Align suggestions with NY State learning standards when relevant
- Be warm and practical — provide content the teacher can directly copy
- Use bullet points and clear formatting for readability

Grade-level calibration:
- Pre-K/K: single words, pictures, concrete concepts, very simple vocabulary
- Grades 1-2: simple sentences, phonics, basic math, picture support
- Grades 3-5: paragraphs, multi-step problems, content areas emerging
- Grades 6-8: analytical thinking, text evidence, abstract concepts
- Grades 9-12: sophisticated arguments, primary sources, complex analysis`,
          messages: next.map(m => ({ role: m.role, content: m.content }))
        })
      });
      const d = await r.json();
      setMsgs(p => [...p, { role: "assistant", content: d.content?.map(b => b.text || "").join("") || "Sorry, couldn't connect. Try again!" }]);
    } catch { setMsgs(p => [...p, { role: "assistant", content: "Connection issue — please try again! 🌐" }]); }
    setLoading(false);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 14px 6px", display: "flex", flexDirection: "column", gap: 10 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{ maxWidth: "89%", padding: "9px 13px", borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", background: m.role === "user" ? gv.color : "#F4F4F4", color: m.role === "user" ? "white" : "#1A1A1A", fontSize: 13, fontFamily: F, fontWeight: 500, lineHeight: 1.55, whiteSpace: "pre-wrap", animation: "fadeIn 0.2s ease" }}>{m.content}</div>
          </div>
        ))}
        {loading && (
          <div style={{ display: "flex", gap: 5, padding: "9px 13px", background: "#F4F4F4", borderRadius: "16px 16px 16px 4px", width: "fit-content" }}>
            {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#CCC", animation: `bounce 1.2s ${i * 0.2}s infinite` }} />)}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <div style={{ padding: "10px 12px", borderTop: "1px solid #EEE", display: "flex", gap: 8 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} spellCheck placeholder="Ask for ideas or help…" style={{ flex: 1, padding: "9px 13px", borderRadius: 18, border: `2px solid ${gv.color}35`, fontSize: 13, fontFamily: F, outline: "none", background: "#FAFAFA" }} />
        <button onClick={send} disabled={loading} style={{ padding: "9px 14px", borderRadius: 18, border: "none", background: gv.color, color: "white", fontWeight: 900, cursor: "pointer", fontSize: 15, opacity: loading ? 0.6 : 1, fontFamily: F }}>→</button>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STANDARDS MODAL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function StandardsModal({ gv, onClose, onInsert, onGenerate }) {
  const subjects = Object.keys(NY_STANDARDS);
  const [subj, setSubj] = useState("ELA");
  const [band, setBand] = useState("Kindergarten");
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState(null);
  const [showHeader, setShowHeader] = useState(true);

  const bands = Object.keys(NY_STANDARDS[subj] || {});
  const stds = NY_STANDARDS[subj]?.[band] || [];
  const filtered = search.trim()
    ? stds.filter(s => s.code.toLowerCase().includes(search.toLowerCase()) || s.desc.toLowerCase().includes(search.toLowerCase()))
    : stds;

  const handlePick = (s) => { setPicked(s); };

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
            <select value={subj} onChange={e => { const s = e.target.value; setSubj(s); setBand(s === "ELA" ? "Kindergarten" : Object.keys(NY_STANDARDS[s] || {})[0] || ""); setPicked(null); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "2px solid #EEE", fontFamily: F, fontSize: 13, outline: "none" }}>
              {subjects.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={{ ...LBL, marginTop: 0 }}>Grade Band</label>
            <select value={band} onChange={e => { setBand(e.target.value); setPicked(null); }} style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "2px solid #EEE", fontFamily: F, fontSize: 13, outline: "none" }}>
              {bands.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ ...LBL, marginTop: 0 }}>Search Standards</label>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by code or keyword…" style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: "2px solid #EEE", fontFamily: F, fontSize: 13, outline: "none", boxSizing: "border-box" }} />
          </div>
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
      if (el.type === "instruction") return `<div style="background:#FFFACD;padding:10px 16px;border-radius:10px;border-left:6px solid ${gv2.color};margin-bottom:16px;font-size:${Math.max(fs-7,13)}px;font-weight:700;line-height:1.55">${el.text||""}</div>`;
      if (el.type === "text") return `<p style="font-size:${fs}px;font-weight:600;margin:0 0 16px;line-height:1.7">${el.text||""}</p>`;
      if (el.type === "multipleChoice") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 10px">${el.question||""}</p>${(el.choices||[]).map(c=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:50%;border:2.5px solid ${gv2.color};flex-shrink:0"></div><span style="font-size:${fs}px">${c}</span></div>`).join("")}</div>`;
      if (el.type === "truefalse") return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs-5,13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">True or False? Circle your answer.</p>${(el.statements||[]).map(s=>`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:8px 12px;background:${gv2.light};border-radius:8px"><span style="font-size:${fs}px">${s}</span><span style="font-size:12px;font-weight:900;color:${gv2.color};margin-left:20px;white-space:nowrap">TRUE &nbsp;&nbsp; FALSE</span></div>`).join("")}</div>`;
      if (el.type === "shortAnswer") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${el.question||""}</p>${Array.from({length:el.lines||4}).map(()=>`<div style="height:${gv2.lineH*0.9}px;border-bottom:2px solid #CCC;margin-bottom:6px"></div>`).join("")}</div>`;
      if (el.type === "fillBlank") return `<div style="margin-bottom:18px">${el.note?`<p style="font-size:12px;color:#999;margin:0 0 6px">${el.note}</p>`:""}<p style="font-size:${fs}px;line-height:1.9;margin:0">${(el.text||"").split("______").map((p,i,a)=>i<a.length-1?`${p}<span style="display:inline-block;width:90px;border-bottom:2.5px solid ${gv2.color};vertical-align:bottom;margin:0 3px"></span>`:p).join("")}</p></div>`;
      if (el.type === "blank") return `<div style="margin-bottom:18px">${el.label?`<p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${el.label}</p>`:""} ${Array.from({length:el.lines||3}).map(()=>`<div style="height:${gv2.lineH}px;border-bottom:2.5px solid #CCC;margin-bottom:8px"></div>`).join("")}</div>`;
      if (el.type === "matching") return `<div style="margin-bottom:18px">${el.title?`<p style="font-size:${Math.max(fs-4,13)}px;font-weight:800;margin:0 0 12px">${el.title}</p>`:""}<table style="width:100%"><tbody>${(el.left||[]).map((item,i)=>`<tr><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${item}</td><td style="text-align:center;padding:0 8px">—</td><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${(el.right||[])[i]||""}</td></tr>`).join("")}</tbody></table></div>`;
      if (el.type === "wordBank") return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs-4,13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">${el.title||"Word Bank"}</p><div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${gv2.light};border-radius:10px">${(el.words||[]).map(w=>`<span style="font-size:${fs}px;padding:4px 12px;border:2px solid ${gv2.color};border-radius:50px;background:white">${w}</span>`).join("")}</div></div>`;
      if (el.type === "essay") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${el.prompt||""}</p>${Array.from({length:el.lines||14}).map(()=>`<div style="height:${gv2.lineH*0.75}px;border-bottom:1.5px solid #DDD;margin-bottom:4px"></div>`).join("")}</div>`;
      if (el.type === "divider") return `<div style="margin:8px 0;text-align:center;color:${gv2.color};font-size:16px">✦</div>`;
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
    const lines = [`${ws.title}`, "=".repeat(ws.title.length), ""];
    if (ws.showName) lines.push("Name: _______________________________   ");
    if (ws.showDate) lines.push("Date: _______________________________");
    lines.push("");
    ws.elements.forEach((el, i) => {
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
      else if (el.type === "divider") { lines.push("─".repeat(40)); lines.push(""); }
    });
    return lines.join("\n");
  };

  // Build full HTML export
  const toHTML = () => {
    const gv2 = gInfo(ws.gradeId);
    const renderEl = (el) => {
      const fs = gv2.fontSize;
      if (el.type === "instruction") return `<div style="background:#FFFACD;padding:10px 16px;border-radius:10px;border-left:6px solid ${gv2.color};margin-bottom:16px;font-size:${Math.max(fs-7,13)}px;font-weight:700;line-height:1.55">${el.text||""}</div>`;
      if (el.type === "text") return `<p style="font-size:${fs}px;font-weight:600;margin:0 0 16px;line-height:1.7">${el.text||""}</p>`;
      if (el.type === "image" && el.url) return `<div style="text-align:${el.align||"center"};margin-bottom:16px"><img src="${el.url}" style="max-width:${el.size==="small"?"35%":el.size==="large"?"95%":"65%"};border-radius:10px;border:2px solid #EEE">${el.caption?`<p style="font-size:12px;color:#777;text-align:center;margin:6px 0 0">${el.caption}</p>`:""}</div>`;
      if (el.type === "multipleChoice") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 10px">${el.question||""}</p>${(el.choices||[]).map(c=>`<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><div style="width:20px;height:20px;border-radius:50%;border:2.5px solid ${gv2.color};flex-shrink:0"></div><span style="font-size:${fs}px">${c}</span></div>`).join("")}</div>`;
      if (el.type === "truefalse") return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs-5,13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">True or False? Circle your answer.</p>${(el.statements||[]).map(s=>`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:8px 12px;background:${gv2.light};border-radius:8px"><span style="font-size:${fs}px">${s}</span><span style="font-size:12px;font-weight:900;color:${gv2.color};margin-left:20px;white-space:nowrap">TRUE &nbsp;&nbsp; FALSE</span></div>`).join("")}</div>`;
      if (el.type === "shortAnswer") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${el.question||""}</p>${Array.from({length:el.lines||4}).map(()=>`<div style="height:${gv2.lineH*0.9}px;border-bottom:2px solid #CCC;margin-bottom:6px"></div>`).join("")}</div>`;
      if (el.type === "fillBlank") return `<div style="margin-bottom:18px">${el.note?`<p style="font-size:12px;color:#999;margin:0 0 6px">${el.note}</p>`:""}<p style="font-size:${fs}px;line-height:1.9;margin:0">${(el.text||"").split("______").map((p,i,a)=>i<a.length-1?`${p}<span style="display:inline-block;width:90px;border-bottom:2.5px solid ${gv2.color};vertical-align:bottom;margin:0 3px"></span>`:p).join("")}</p></div>`;
      if (el.type === "blank") return `<div style="margin-bottom:18px">${el.label?`<p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${el.label}</p>`:""} ${Array.from({length:el.lines||3}).map(()=>`<div style="height:${gv2.lineH}px;border-bottom:2.5px solid #CCC;margin-bottom:8px"></div>`).join("")}</div>`;
      if (el.type === "wordBank") return `<div style="margin-bottom:18px"><p style="font-size:${Math.max(fs-4,13)}px;font-weight:900;color:${gv2.color};margin:0 0 10px">${el.title||"Word Bank"}</p><div style="display:flex;flex-wrap:wrap;gap:8px;padding:10px 14px;background:${gv2.light};border-radius:10px">${(el.words||[]).map(w=>`<span style="font-size:${fs}px;padding:4px 12px;border:2px solid ${gv2.color};border-radius:50px;background:white">${w}</span>`).join("")}</div></div>`;
      if (el.type === "matching") return `<div style="margin-bottom:18px">${el.title?`<p style="font-size:${Math.max(fs-4,13)}px;font-weight:800;margin:0 0 12px">${el.title}</p>`:""}<table style="width:100%;border-collapse:collapse"><tbody>${(el.left||[]).map((item,i)=>`<tr><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${item}</td><td style="text-align:center;padding:0 8px">—</td><td style="padding:6px 10px;border:2px solid ${gv2.color};border-radius:8px;width:40%;text-align:center;font-size:${fs}px">${(el.right||[])[i]||""}</td></tr>`).join("")}</tbody></table></div>`;
      if (el.type === "essay") return `<div style="margin-bottom:18px"><p style="font-size:${fs}px;font-weight:800;margin:0 0 12px">${el.prompt||""}</p>${Array.from({length:el.lines||14}).map(()=>`<div style="height:${gv2.lineH*0.75}px;border-bottom:1.5px solid #DDD;margin-bottom:4px"></div>`).join("")}</div>`;
      if (el.type === "divider") return `<div style="margin:8px 0;text-align:center;color:${gv2.color};font-size:16px">✦</div>`;
      if (el.type === "table") return `<div style="margin-bottom:18px">${el.title?`<p style="font-size:${Math.max(fs-4,13)}px;font-weight:800;margin:0 0 10px">${el.title}</p>`:""}<table style="width:100%;border-collapse:collapse;font-size:${Math.max(fs-4,12)}px"><thead><tr>${(el.headers||[]).map(h=>`<th style="padding:8px 12px;border:2px solid ${gv2.color};background:${gv2.color};color:white;font-weight:900;text-align:center">${h}</th>`).join("")}</tr></thead><tbody>${(el.rows||[]).map(row=>`<tr>${(row||[]).map(cell=>`<td style="padding:6px 10px;border:1.5px solid #DDD;height:${gv2.lineH}px;vertical-align:top">${cell||""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      return "";
    };
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${ws.title}</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&family=Fredoka+One&display=swap" rel="stylesheet"><style>*{box-sizing:border-box}body{margin:0;font-family:'Nunito',sans-serif}@media print{body{margin:0}}</style></head><body><div style="max-width:760px;margin:0 auto;padding:52px 64px;font-family:'Nunito',sans-serif;position:relative">${ws.showGrade?`<div style="position:absolute;top:14px;right:18px;background:${gv2.light};border:2px solid ${gv2.color}40;border-radius:20px;padding:3px 13px;font-size:11px;font-weight:900;color:${gv2.color}">${gv2.emoji} ${gv2.name}</div>`:""}<div style="border-bottom:3px solid ${gv2.color}25;padding-bottom:8px;margin-bottom:16px"><h1 style="font-family:'Fredoka One',cursive;color:${gv2.color};font-size:${gv2.fontSize+6}px;margin:0 0 14px;padding-right:120px">${ws.title}</h1><div style="display:flex;gap:44px">${ws.showName?`<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize-10,12)}px">Name:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>`:""} ${ws.showDate?`<div style="display:flex;align-items:center;gap:8px;flex:1"><span style="font-weight:700;font-size:${Math.max(gv2.fontSize-10,12)}px">Date:</span><div style="flex:1;border-bottom:2px solid #CCC;height:22px"></div></div>`:""}</div></div>${ws.elements.map(renderEl).join("")}</div></body></html>`;
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
// MAIN APP
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function WorksheetBuilder() {
  const [ws, setWs] = useState({ title: "My Worksheet", showName: true, showDate: true, showGrade: true, gradeId: "k", elements: [] });
  const [selId, setSelId] = useState(null);
  const [rightTab, setRightTab] = useState("edit");
  const [showHelp, setShowHelp]       = useState(false);
  const [showStds, setShowStds]       = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showExport, setShowExport]   = useState(false);
  const [refImg, setRefImg] = useState(null);
  const [refDesc, setRefDesc] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [statusMsg, setStatusMsg] = useState(""); // aria-live announcements
  // Resize state
  const resizeRef = useRef(null);

  const gv = gInfo(ws.gradeId);
  const selEl = ws.elements.find(e => e.id === selId) || null;

  const announce = (msg) => { setStatusMsg(msg); setTimeout(() => setStatusMsg(""), 3000); };

  const setF = (k, v) => setWs(p => ({ ...p, [k]: v }));
  const addEl = (type) => {
    const el = mkEl(type, nextSlot(ws.elements.length));
    setWs(p => ({ ...p, elements: [...p.elements, el] }));
    setSelId(el.id); setRightTab("edit");
    announce(`${PALETTE.find(p => p.type === type)?.label || type} element added`);
  };
  const updEl = (id, u) => setWs(p => ({ ...p, elements: p.elements.map(e => e.id === id ? { ...e, ...u } : e) }));
  const delEl = (id) => {
    setWs(p => ({ ...p, elements: p.elements.filter(e => e.id !== id) }));
    setSelId(null); announce("Element deleted");
  };
  const movEl = (id, d) => setWs(p => {
    const els = [...p.elements], i = els.findIndex(e => e.id === id);
    if (d === "up" && i > 0) [els[i - 1], els[i]] = [els[i], els[i - 1]];
    else if (d === "down" && i < els.length - 1) [els[i], els[i + 1]] = [els[i + 1], els[i]];
    return { ...p, elements: els };
  });

  // ── 4-sided drag-to-resize ─────────────────────────────────────────
  const handleResizeStart = (e, elId, direction) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const el = ws.elements.find(x => x.id === elId);
    const startH = el?.heightOverride || 80;
    const startW = el?.widthOverride  || 100; // percent of container
    // Get element DOM width in px for percentage calc
    const paperWidth = 632; // approx inner width of 760px paper with 64px padding each side

    resizeRef.current = { elId, startX, startY, startH, startW, direction };

    const onMove = (mv) => {
      if (!resizeRef.current) return;
      const { direction, startX, startY, startH, startW } = resizeRef.current;
      const dy = mv.clientY - startY;
      const dx = mv.clientX - startX;

      if (direction === "bottom") {
        updEl(elId, { heightOverride: Math.max(48, startH + dy) });
      } else if (direction === "top") {
        updEl(elId, { heightOverride: Math.max(48, startH - dy) });
      } else if (direction === "right") {
        const newW = Math.min(100, Math.max(20, startW + (dx / paperWidth) * 100));
        updEl(elId, { widthOverride: Math.round(newW) });
      } else if (direction === "left") {
        const newW = Math.min(100, Math.max(20, startW - (dx / paperWidth) * 100));
        updEl(elId, { widthOverride: Math.round(newW) });
      } else if (direction === "corner") {
        updEl(elId, {
          heightOverride: Math.max(48, startH + dy),
          widthOverride:  Math.min(100, Math.max(20, startW + (dx / paperWidth) * 100)),
        });
      }
    };
    const onUp = () => {
      resizeRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  // ── Free-position drag — move element anywhere on the page (mouse + touch) ─
  const dragRef = useRef(null);
  const handleDragStart = (e, elId) => {
    // Don't start drag from interactive children (resize handles, delete btn, inputs)
    const tgt = e.target;
    if (tgt.closest && (tgt.closest("[data-resize-handle]") || tgt.closest("[data-delete-btn]") || tgt.closest("input,textarea,select,button,a"))) return;
    e.preventDefault();
    const el = ws.elements.find(x => x.id === elId);
    if (!el) return;
    const paperWidth = 632;
    dragRef.current = {
      elId,
      startX: e.clientX, startY: e.clientY,
      startElX: el.x || 0,                // %
      startElY: el.y || 0,                // px
      paperWidth,
    };
    setSelId(elId);
    const onMove = (mv) => {
      if (!dragRef.current) return;
      const { startX, startY, startElX, startElY, paperWidth } = dragRef.current;
      const dxPct = ((mv.clientX - startX) / paperWidth) * 100;
      const dyPx  = mv.clientY - startY;
      const newX = Math.max(0, Math.min(100, startElX + dxPct));
      const newY = Math.max(0, startElY + dyPx);
      updEl(elId, { x: newX, y: newY });
    };
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const [generating, setGenerating] = useState(false);

  const insertStandard = (std, showHeader = true) => {
    if (!showHeader) return; // standard used for context only — no element inserted
    // Header spans full width at top of page
    const el = { id: uid(), type: "instruction", text: `📌 NYS Standard ${std.code}: ${std.desc}`, x: 0, y: 0, widthOverride: 100 };
    // Push existing elements down to make room
    setWs(p => ({ ...p, elements: [el, ...p.elements.map(e => ({ ...e, y: (e.y || 0) + ROW_HEIGHT }))] }));
    setSelId(el.id);
  };

  const handleGenerateFromStd = async (std, showHeader) => {
    setGenerating(true);
    // Optionally insert header first
    if (showHeader) {
      insertStandard(std, true);
    }
    const g = gInfo(ws.gradeId);
    const bandLabel = BANDS[g.band]?.label || g.name;
    try {
      const res = await fetch("https://iaklmdnlwjgguhkixvio.supabase.co/functions/v1/anthropic-proxy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: `You are an expert curriculum designer creating complete, print-ready worksheets for NY State teachers. Always respond with valid JSON only — no markdown, no preamble, no explanation outside the JSON array.`,
          messages: [{
            role: "user",
            content: `Design a complete, engaging worksheet for ${g.name} students (${bandLabel}) aligned to NY State Standard ${std.code}: "${std.desc}".

Return ONLY a JSON array of 5–8 worksheet elements. Each element must use EXACTLY one of these types and shapes:

{"type":"instruction","text":"<directions string>"}
{"type":"text","text":"<passage or content string>"}
{"type":"blank","label":"<question or prompt>","lines":3}
{"type":"wordBank","title":"📚 Word Bank","words":["word1","word2","word3","word4","word5"]}
{"type":"matching","title":"<title>","left":["item1","item2","item3"],"right":["match1","match2","match3"]}
{"type":"multipleChoice","question":"<question>","note":"Circle the correct answer.","choices":["A. option","B. option","C. option","D. option"]}
{"type":"truefalse","statements":["statement1","statement2","statement3"]}
{"type":"shortAnswer","question":"<question>","lines":4}
{"type":"fillBlank","text":"<sentence with ______ for blanks>","note":"<optional hint>"}
{"type":"essay","prompt":"<essay prompt>","points":10,"lines":14}

Calibrate complexity to ${g.name}:
- Pre-K/K/Gr1-2: short words, simple sentences, pictures concepts, fun emoji, concrete tasks
- Gr3-5: 1-2 paragraph passages, multi-step activities, content-area vocabulary
- Gr6-8: analytical tasks, text evidence, abstract thinking, structured writing
- Gr9-12: sophisticated analysis, argument construction, primary source engagement

Include a variety of activity types. Make the content directly address the standard. Output ONLY the JSON array.`
          }]
        })
      });
      const data = await res.json();
      const raw = data.content?.map(b => b.text || "").join("") || "[]";
      const clean = raw.replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(clean);
      const startIdx = showHeader ? 1 : 0; // reserve slot 0 for header row
      const newEls = parsed.map((el, i) => {
        const slot = nextSlot(startIdx + i);
        return { ...mkEl(el.type, slot), ...el, id: uid(), x: slot.x, y: slot.y, widthOverride: slot.widthOverride };
      });
      setWs(p => ({
        ...p,
        title: p.title === "My Worksheet" ? `${std.code} Worksheet` : p.title,
        elements: showHeader
          ? [{ ...p.elements[0], y: 0, x: 0, widthOverride: 100 }, ...newEls].filter(Boolean)
          : newEls
      }));
      setSelId(null);
    } catch (err) {
      console.error("Generate error:", err);
    }
    setGenerating(false);
  };

  const addGeneratedImage = (url) => {
    const slot = nextSlot(ws.elements.length);
    const el = mkEl("image", slot); el.url = url; el.caption = ""; el.size = "small"; el.align = "left";
    setWs(p => ({ ...p, elements: [...p.elements, el] })); setSelId(el.id); setRightTab("edit");
  };

  const handleRefUpload = async (file) => {
    if (!file.type.startsWith("image/")) { setRefDesc("PDF uploaded — describe it in AI Help to get suggestions!"); setRefImg(URL.createObjectURL(file)); return; }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const b64 = ev.target.result;
      setRefImg(b64); setAnalyzing(true);
      try {
        const res = await fetch("https://iaklmdnlwjgguhkixvio.supabase.co/functions/v1/anthropic-proxy", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514", max_tokens: 350,
            messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: file.type, data: b64.split(",")[1] } }, { type: "text", text: "A teacher uploaded this reference worksheet. In 2–3 sentences, describe its structure, activity types, subject area, and approximate grade level so I can help recreate or build similar worksheets. Be concise and practical." }] }]
          })
        });
        const d = await res.json();
        setRefDesc(d.content?.map(b => b.text || "").join("") || "Reference uploaded.");
      } catch { setRefDesc("Reference uploaded (automatic analysis unavailable — describe it in AI Help)."); }
      setAnalyzing(false);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="app-shell" style={{ display: "flex", flexDirection: "column", height: "100vh", fontFamily: F, background: "#F8F9FA", overflow: "hidden" }}>
      <style>{PRINT_CSS}</style>

      {/* Skip navigation */}
      <a href="#worksheet-canvas" className="skip-nav no-print">Skip to worksheet</a>

      {/* Aria live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="no-print" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>{statusMsg}</div>

      {/* ── TOP BAR ── */}
      <header role="banner" className="no-print" style={{ height: 56, background: "white", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", padding: "0 16px", gap: 12, flexShrink: 0, zIndex: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: gv.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }} aria-hidden="true">📄</div>
          <div style={{ lineHeight: 1.15 }}>
            <div style={{ fontFamily: FF, color: gv.color, fontSize: 15, fontWeight: 700 }}>WorksheetBuilder</div>
            <div style={{ fontSize: 9.5, color: "#9CA3AF", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>NY Standards · Pre-K–12</div>
          </div>
        </div>

        <div style={{ width: 1, height: 28, background: "#E5E7EB", margin: "0 2px", flexShrink: 0 }} aria-hidden="true" />

        <input
          value={ws.title} onChange={e => setF("title", e.target.value)} spellCheck
          aria-label="Worksheet title"
          style={{ flex: 1, fontSize: 15, fontWeight: 600, fontFamily: F, border: "none", outline: "none", background: "transparent", color: "#111827", minWidth: 0 }}
          placeholder="Worksheet Title…" />

        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <label htmlFor="grade-select" style={{ fontSize: 11, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Grade</label>
          <select id="grade-select" value={ws.gradeId} onChange={e => setF("gradeId", e.target.value)}
            aria-label="Select grade level"
            style={{ padding: "5px 10px", borderRadius: 7, border: `1.5px solid ${gv.color}`, fontFamily: F, fontWeight: 700, fontSize: 13, color: gv.color, outline: "none", background: gv.light, cursor: "pointer" }}>
            <optgroup label="🌱 Early Childhood"><option value="pk">Pre-K</option><option value="k">Kindergarten</option><option value="1">Grade 1</option><option value="2">Grade 2</option></optgroup>
            <optgroup label="⭐ Elementary"><option value="3">Grade 3</option><option value="4">Grade 4</option><option value="5">Grade 5</option></optgroup>
            <optgroup label="🏫 Middle School"><option value="6">Grade 6</option><option value="7">Grade 7</option><option value="8">Grade 8</option></optgroup>
            <optgroup label="🎓 High School"><option value="9">Grade 9</option><option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option></optgroup>
          </select>
        </div>

        <fieldset style={{ border: "none", margin: 0, padding: "4px 10px", background: "#F9FAFB", borderRadius: 7, border: "1px solid #E5E7EB", display: "flex", gap: 10, flexShrink: 0 }}>
          <legend style={{ fontSize: 9, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", padding: "0 2px", letterSpacing: 0.5 }}>Show</legend>
          {[["showName", "Name"], ["showDate", "Date"], ["showGrade", "Grade"]].map(([k, l]) => (
            <label key={k} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, fontWeight: 600, color: "#374151", cursor: "pointer" }}>
              <input type="checkbox" checked={ws[k]} onChange={e => setF(k, e.target.checked)} aria-label={`Show ${l} on worksheet`} style={{ accentColor: gv.color, width: 14, height: 14 }} /> {l}
            </label>
          ))}
        </fieldset>

        <button onClick={() => setShowHelp(true)} aria-label="Open help documentation"
          style={{ padding: "6px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: "white", cursor: "pointer", fontFamily: F, fontWeight: 600, fontSize: 13, color: "#374151" }}>Help</button>
        <button onClick={() => setShowVersions(true)} aria-label="Create quiz versions with randomized questions"
          style={{ padding: "6px 12px", borderRadius: 7, border: "1.5px solid #E5E7EB", background: "white", cursor: "pointer", fontFamily: F, fontWeight: 600, fontSize: 13, color: "#374151" }}>🔀 Versions</button>
        <button onClick={() => setShowExport(true)} aria-label="Export or print worksheet"
          style={{ padding: "6px 14px", borderRadius: 7, border: "none", background: gv.color, color: "white", cursor: "pointer", fontFamily: F, fontWeight: 700, fontSize: 13 }}>📤 Export</button>
      </header>

      {/* ── 3-COLUMN BODY ── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* LEFT PANEL */}
        <nav role="navigation" aria-label="Worksheet tools" className="no-print" style={{ width: 196, background: "white", borderRight: "1px solid #E5E7EB", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>

          {/* Standards button */}
          <div style={{ padding: "10px 10px 8px", borderBottom: "1px solid #F3F4F6" }}>
            <button onClick={() => setShowStds(true)} aria-label="Browse NY State Standards"
              style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1.5px solid ${gv.color}`, background: gv.light, color: gv.color, fontFamily: F, fontWeight: 700, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.background = gv.color; e.currentTarget.style.color = "white"; }}
              onMouseLeave={e => { e.currentTarget.style.background = gv.light; e.currentTarget.style.color = gv.color; }}>
              🗽 NY Standards
            </button>
          </div>

          {/* Reference Upload */}
          <div style={{ padding: "8px 10px", borderBottom: "1px solid #F3F4F6" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, margin: "0 0 6px 0", fontFamily: F }}>Reference Worksheet</p>
            {refImg ? (
              <div style={{ position: "relative" }}>
                <img src={refImg} alt="Uploaded reference worksheet" style={{ width: "100%", borderRadius: 7, border: "1px solid #E5E7EB", maxHeight: 88, objectFit: "cover" }} />
                {analyzing && <div style={{ position: "absolute", inset: 0, background: "rgba(255,255,255,0.88)", display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 7, fontSize: 11, fontWeight: 700, color: gv.color, fontFamily: F }}>Analyzing…</div>}
                <button onClick={() => { setRefImg(null); setRefDesc(""); }} aria-label="Remove reference worksheet"
                  style={{ position: "absolute", top: 4, right: 4, background: "rgba(255,255,255,0.92)", border: "none", borderRadius: "50%", width: 20, height: 20, cursor: "pointer", fontSize: 11, fontWeight: 800, color: "#6B7280" }}>✕</button>
              </div>
            ) : (
              <label style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "10px 8px", borderRadius: 8, border: `1.5px dashed ${gv.color}45`, background: gv.light, cursor: "pointer", textAlign: "center" }}>
                <span style={{ fontSize: 20 }} aria-hidden="true">📎</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: gv.color, lineHeight: 1.3, fontFamily: F }}>Upload Example</span>
                <span style={{ fontSize: 10, color: "#9CA3AF", fontFamily: F }}>Image or PDF</span>
                <input type="file" accept="image/*,.pdf" aria-label="Upload reference worksheet" onChange={e => e.target.files[0] && handleRefUpload(e.target.files[0])} style={{ display: "none" }} />
              </label>
            )}
            {refDesc && !analyzing && <p style={{ fontSize: 10, color: "#6B7280", margin: "6px 0 0", lineHeight: 1.45, fontFamily: F }}>{refDesc}</p>}
          </div>

          {/* Element palette */}
          <div style={{ padding: "6px 8px 2px" }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, margin: 0, fontFamily: F }}>Add Element</p>
          </div>
          <div style={{ overflowY: "auto", padding: "2px 6px 10px", flex: 1 }} role="list" aria-label="Worksheet elements">
            {PALETTE.map(p => (
              <button key={p.type} onClick={() => addEl(p.type)} role="listitem" aria-label={`Add ${p.label} element`}
                style={{ width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 7, border: "1.5px solid transparent", background: "transparent", cursor: "pointer", fontFamily: F, fontWeight: 600, fontSize: 12.5, color: "#374151", display: "flex", alignItems: "center", gap: 7, marginBottom: 1, transition: "all 0.1s" }}
                onMouseEnter={e => { e.currentTarget.style.background = gv.light; e.currentTarget.style.borderColor = gv.color + "35"; e.currentTarget.style.color = gv.color; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.color = "#374151"; }}>
                <span style={{ fontSize: 14, flexShrink: 0 }} aria-hidden="true">{p.emoji}</span>
                <span>{p.label}</span>
              </button>
            ))}
          </div>

          <div style={{ padding: "6px 12px", borderTop: "1px solid #F3F4F6", fontSize: 11, color: "#9CA3AF", fontWeight: 600, fontFamily: F }} aria-live="polite">
            {ws.elements.length} element{ws.elements.length !== 1 ? "s" : ""}
          </div>
        </nav>

        {/* CENTER: WORKSHEET CANVAS */}
        <main id="worksheet-canvas" role="main" aria-label="Worksheet canvas" className="canvas-area" style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "28px 18px", background: "#F1F3F5", position: "relative" }}>
          {/* Generating overlay */}
          {generating && (
            <div role="status" aria-label="Generating worksheet content" style={{ position: "absolute", inset: 0, background: "rgba(241,243,245,0.9)", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: gv.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, animation: "spin 2s linear infinite" }} aria-hidden="true">✨</div>
              <div style={{ textAlign: "center" }}>
                <p style={{ fontFamily: FF, fontSize: 18, color: gv.color, margin: "0 0 5px 0", fontWeight: 700 }}>Designing your worksheet…</p>
                <p style={{ fontFamily: F, fontSize: 13, color: "#6B7280", margin: 0 }}>AI is building activities aligned to the standard</p>
              </div>
            </div>
          )}
          <div className="worksheet-paper" style={{ width: 760, minHeight: 970, background: "white", boxShadow: "0 2px 20px rgba(0,0,0,0.1), 0 1px 4px rgba(0,0,0,0.06)", borderRadius: 4, padding: "52px 64px", position: "relative" }}>

            {ws.showGrade && <div aria-label={`Grade level: ${gv.name}`} style={{ position: "absolute", top: 14, right: 18, background: gv.light, border: `1.5px solid ${gv.color}35`, borderRadius: 20, padding: "3px 12px", fontSize: 11, fontWeight: 700, color: gv.color, fontFamily: F }}>{gv.emoji} {gv.name}</div>}

            {/* Title + Name/Date header */}
            <div style={{ marginBottom: 24 }}>
              <input value={ws.title} onChange={e => setF("title", e.target.value)} spellCheck
                aria-label="Worksheet title on page"
                style={{ width: "100%", fontSize: gv.fontSize + 5, fontWeight: 700, fontFamily: FF, color: gv.color, border: "none", outline: "none", background: "transparent", borderBottom: `2px solid ${gv.color}20`, paddingBottom: 8, marginBottom: 16, paddingRight: 120 }} placeholder="Worksheet Title" />
              <div style={{ display: "flex", gap: 44 }}>
                {ws.showName && (<div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1 }}><span style={{ fontSize: Math.max(gv.fontSize - 10, 11), fontWeight: 600, fontFamily: F, color: "#374151", whiteSpace: "nowrap" }}>Name:</span><div style={{ flex: 1, borderBottom: "1.5px solid #D1D5DB", height: 22 }} aria-hidden="true" /></div>)}
                {ws.showDate && (<div style={{ display: "flex", alignItems: "center", gap: 7, flex: 1 }}><span style={{ fontSize: Math.max(gv.fontSize - 10, 11), fontWeight: 600, fontFamily: F, color: "#374151", whiteSpace: "nowrap" }}>Date:</span><div style={{ flex: 1, borderBottom: "1.5px solid #D1D5DB", height: 22 }} aria-hidden="true" /></div>)}
              </div>
            </div>

            {/* Free-position canvas — elements absolutely positioned, draggable */}
            {ws.elements.length === 0 ? (
              <div style={{ textAlign: "center", padding: "80px 30px" }} role="status">
                <div style={{ width: 64, height: 64, borderRadius: 16, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: 28 }} aria-hidden="true">📝</div>
                <p style={{ fontFamily: FF, fontSize: 16, fontWeight: 700, color: "#9CA3AF", margin: "0 0 8px" }}>Your worksheet is empty</p>
                <p style={{ fontFamily: F, fontSize: 13, color: "#D1D5DB", lineHeight: 1.7, margin: 0 }}>Add elements from the left panel · Drag blocks anywhere · Up to 3 across</p>
              </div>
            ) : (
              <div style={{
                position: "relative",
                width: "100%",
                minHeight: Math.max(700, ...ws.elements.map(e => (e.y || 0) + (e.heightOverride || 180) + 40)),
              }}>
                {ws.elements.map(el => (
                  <ElView key={el.id} el={el} gv={gv} selected={selId === el.id}
                    onClick={() => { setSelId(el.id); setRightTab("edit"); }}
                    onResize={handleResizeStart}
                    onDragStart={handleDragStart}
                    onDelete={(id) => delEl(id)} />
                ))}
              </div>
            )}
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside role="complementary" aria-label="Element editor and tools" className="no-print" style={{ width: 292, background: "white", borderLeft: "1px solid #E5E7EB", display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
          <div style={{ display: "flex", borderBottom: "1px solid #E5E7EB", flexShrink: 0 }}>
            {[["edit", "✏️ Edit"], ["image", "🎨 Image"], ["ai", "🤖 AI Help"]].map(([t, l]) => (
              <button key={t} onClick={() => setRightTab(t)} role="tab" aria-selected={rightTab === t} aria-controls={`panel-${t}`}
                style={{ flex: 1, padding: "10px 4px", border: "none", borderBottom: rightTab === t ? `2px solid ${gv.color}` : "2px solid transparent", background: rightTab === t ? gv.light : "transparent", color: rightTab === t ? gv.color : "#9CA3AF", fontFamily: F, fontWeight: 700, fontSize: 11.5, cursor: "pointer", marginBottom: -1, transition: "all 0.12s", whiteSpace: "nowrap" }}>{l}</button>
            ))}
          </div>
          <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }} role="tabpanel">
            {rightTab === "edit"  && <ElEditor el={selEl} gv={gv} onChange={u => selEl && updEl(selEl.id, u)} onDelete={() => selEl && delEl(selEl.id)} onMoveUp={() => selEl && movEl(selEl.id, "up")} onMoveDown={() => selEl && movEl(selEl.id, "down")} />}
            {rightTab === "image" && <AIImageGen gv={gv} onAddImage={addGeneratedImage} />}
            {rightTab === "ai"    && <AIChat gv={gv} wsTitle={ws.title} elCount={ws.elements.length} refDesc={refDesc} />}
          </div>
        </aside>
      </div>

      {showHelp     && <HelpModal     onClose={() => setShowHelp(false)}     gv={gv} />}
      {showStds     && <StandardsModal gv={gv} onClose={() => setShowStds(false)} onInsert={insertStandard} onGenerate={handleGenerateFromStd} />}
      {showVersions && <VersionsModal  gv={gv} ws={ws} onClose={() => setShowVersions(false)} />}
      {showExport   && <ExportModal    gv={gv} ws={ws} onClose={() => setShowExport(false)} />}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EMAIL ASSISTANT TOOL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const EMAIL_RECIPIENTS = [
  { id:"administrator", label:"Administrator",    icon:"🏫", desc:"Principal, VP, district staff" },
  { id:"colleague",     label:"Colleague",        icon:"👩‍🏫", desc:"Fellow teachers, support staff" },
  { id:"parent",        label:"Parent / Guardian", icon:"👨‍👩‍👧", desc:"Families of students" },
];
const EMAIL_TONES = [
  { id:"formal",           label:"Formal",             desc:"Structured & highly professional" },
  { id:"warm-professional",label:"Warm & Professional", desc:"Friendly but polished" },
  { id:"direct",           label:"Direct & Clear",      desc:"Concise and to the point" },
  { id:"academic",         label:"Academic",            desc:"Scholarly, precise & evidence-informed" },
];
const EMAIL_SITUATIONS = [
  "Reporting a concern","Sharing good news","Requesting a meeting",
  "Following up","Responding to a complaint","Providing an update",
  "Asking for help / resources","Scheduling / logistics","Other",
];

function EmailAssistant() {
  const [recipient, setRecipient] = useState("administrator");
  const [tone, setTone]           = useState("warm-professional");
  const [situation, setSituation] = useState("Responding to a complaint");
  const [draft, setDraft]         = useState("");
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [copied, setCopied]       = useState(false);
  const [error, setError]         = useState(null);
  const [listening, setListening] = useState(false);
  const recognitionRef            = useRef(null);

  const toggleVoice = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { setError("Voice input requires Chrome or Edge."); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    const rec = new SR();
    rec.continuous = true; rec.interimResults = true; rec.lang = "en-US";
    let base = draft;
    rec.onresult = (e) => {
      let finals = base, interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) { finals += (finals ? " " : "") + e.results[i][0].transcript; base = finals; }
        else interim += e.results[i][0].transcript;
      }
      setDraft(finals + (interim ? " " + interim : ""));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => { setListening(false); setError("Voice error — please try again."); };
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const polish = async () => {
    if (!draft.trim()) return;
    setLoading(true); setResult(null); setError(null);
    const rLabel = EMAIL_RECIPIENTS.find(r => r.id === recipient)?.label;
    const tObj   = EMAIL_TONES.find(t => t.id === tone);
    try {
      const res = await fetch("https://iaklmdnlwjgguhkixvio.supabase.co/functions/v1/anthropic-proxy", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:1000,
          system:`You are an expert writing assistant helping a teacher compose professional emails.
Recipient: ${rLabel}. Tone: ${tObj?.label} — ${tObj?.desc}. Situation: ${situation}.
Rules: maintain respect and professionalism; keep the teacher's core intent; add a subject line; clear structure; not overly wordy.
Respond ONLY as valid JSON (no markdown fences): {"subject":"...","email":"..."}`,
          messages:[{role:"user", content:`Polish this into a professional email:\n\n${draft}`}],
        }),
      });
      const data = await res.json();
      const text = data.content?.map(b => b.text||"").join("") || "";
      setResult(JSON.parse(text.replace(/```json|```/g,"").trim()));
    } catch { setError("Something went wrong. Please try again."); }
    setLoading(false);
  };

  const copyEmail = () => {
    navigator.clipboard.writeText(`Subject: ${result.subject}\n\n${result.email}`);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  // shared style tokens
  const BRAND = "#6D28D9";
  const LIGHT  = "#F5F3FF";
  const card = { background:"white", borderRadius:10, border:"1px solid #E5E7EB", overflow:"hidden" };
  const cardHead = { background:BRAND, padding:"12px 18px", display:"flex", alignItems:"center", gap:8 };
  const cardHeadTxt = { fontFamily:"'Playfair Display',serif", color:"white", fontSize:15, fontWeight:700 };
  const lbl = { fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#6B7280", display:"block", marginBottom:6 };
  const inp = { width:"100%", padding:"9px 11px", borderRadius:7, border:"1.5px solid #D1D5DB", fontFamily:"'Inter',sans-serif", fontSize:13, color:"#111827", outline:"none", boxSizing:"border-box", background:"white" };

  return (
    <div style={{ padding:"28px 32px", maxWidth:1080, margin:"0 auto", display:"grid", gridTemplateColumns:"1fr 1fr", gap:28, alignItems:"start" }}>

      {/* LEFT: Compose */}
      <div style={card}>
        <div style={cardHead}><span style={cardHeadTxt}>✏️  Compose</span></div>
        <div style={{ padding:"20px 20px 24px" }}>

          <span style={lbl}>Who are you writing to?</span>
          <div style={{ display:"flex", flexDirection:"column", gap:7, marginBottom:18 }}>
            {EMAIL_RECIPIENTS.map(r => (
              <button key={r.id} onClick={() => setRecipient(r.id)}
                style={{ display:"flex", alignItems:"center", gap:12, padding:"11px 14px", borderRadius:8, border:`1.5px solid ${recipient===r.id ? BRAND : "#E5E7EB"}`, background: recipient===r.id ? LIGHT : "white", cursor:"pointer", textAlign:"left", transition:"all 0.12s" }}>
                <span style={{ fontSize:20 }}>{r.icon}</span>
                <div>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, color: recipient===r.id ? BRAND : "#111827" }}>{r.label}</div>
                  <div style={{ fontSize:11, color:"#6B7280", marginTop:1 }}>{r.desc}</div>
                </div>
              </button>
            ))}
          </div>

          <span style={lbl}>Tone</span>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6, marginBottom:18 }}>
            {EMAIL_TONES.map(t => (
              <button key={t.id} onClick={() => setTone(t.id)}
                style={{ padding:"9px 12px", borderRadius:8, border:`1.5px solid ${tone===t.id ? BRAND : "#E5E7EB"}`, background: tone===t.id ? LIGHT : "white", cursor:"pointer", textAlign:"left", transition:"all 0.12s" }}>
                <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, color: tone===t.id ? BRAND : "#111827" }}>{t.label}</div>
                <div style={{ fontSize:10.5, color:"#9CA3AF", marginTop:2 }}>{t.desc}</div>
              </button>
            ))}
          </div>

          <span style={lbl}>Situation</span>
          <select value={situation} onChange={e => setSituation(e.target.value)} style={{ ...inp, marginBottom:18, cursor:"pointer" }}>
            {EMAIL_SITUATIONS.map(s => <option key={s}>{s}</option>)}
          </select>

          <span style={lbl}>Your rough draft or key points</span>
          <div style={{ position:"relative" }}>
            <textarea value={draft} onChange={e => setDraft(e.target.value)} spellCheck placeholder="Write your rough draft, key points, or anything you want to say. Don't worry about being polished — that's our job!" 
              style={{ ...inp, minHeight:160, resize:"vertical", lineHeight:1.6, paddingRight:46, background:"#FAFAFA" }} />
            <button onClick={toggleVoice} title={listening ? "Stop recording" : "Speak your draft"}
              style={{ position:"absolute", top:10, right:10, width:32, height:32, border: listening ? `2px solid #DC2626` : "1.5px solid #D1D5DB", borderRadius:"50%", background: listening ? "#DC2626" : "white", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", boxShadow: listening ? "0 0 0 4px rgba(220,38,38,0.15)" : "none", transition:"all 0.2s" }}>
              {listening ? <span style={{ fontSize:12 }}>⏹</span> : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={listening?"#fff":"#374151"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>}
            </button>
          </div>

          {error && <div style={{ background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:7, padding:"10px 14px", color:"#DC2626", fontSize:13, marginTop:10, marginBottom:4 }}>{error}</div>}

          <button onClick={polish} disabled={loading || !draft.trim()}
            style={{ width:"100%", marginTop:14, padding:"12px", borderRadius:8, border:"none", background: !draft.trim()||loading ? "#E5E7EB" : BRAND, color: !draft.trim()||loading ? "#9CA3AF" : "white", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:14, cursor: !draft.trim()||loading ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, letterSpacing:0.3 }}>
            {loading ? <><span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"white", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite" }} />Polishing…</> : "✦  Polish My Email"}
          </button>
        </div>
      </div>

      {/* RIGHT: Result */}
      <div style={{ ...card, minHeight:500, display:"flex", flexDirection:"column" }}>
        <div style={cardHead}><span style={cardHeadTxt}>📨  Polished Email</span></div>
        <div style={{ padding:"20px", flex:1, display:"flex", flexDirection:"column" }}>
          {loading ? (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14 }}>
              <div style={{ width:36, height:36, border:`3px solid #E5E7EB`, borderTopColor:BRAND, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#6B7280", fontStyle:"italic" }}>Crafting your professional email…</p>
            </div>
          ) : result ? (
            <>
              <div style={{ background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:7, padding:"10px 14px", marginBottom:14, display:"flex", gap:10, alignItems:"baseline" }}>
                <span style={{ fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#6B7280", whiteSpace:"nowrap" }}>Subject</span>
                <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, color:"#111827" }}>{result.subject}</span>
              </div>
              <div style={{ fontFamily:"'Inter',sans-serif", fontSize:13, lineHeight:1.8, color:"#1F2937", whiteSpace:"pre-wrap", flex:1 }}>{result.email}</div>
              <button onClick={copyEmail}
                style={{ marginTop:18, padding:"10px", borderRadius:8, border:`1.5px solid ${copied ? "#059669" : BRAND}`, background: copied ? "#D1FAE5" : "white", color: copied ? "#059669" : BRAND, fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", transition:"all 0.2s" }}>
                {copied ? "✓  Copied to Clipboard!" : "Copy Full Email"}
              </button>
            </>
          ) : (
            <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:12, textAlign:"center", color:"#9CA3AF" }}>
              <div style={{ fontSize:44, opacity:0.35 }}>📝</div>
              <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, lineHeight:1.7 }}>Fill in your details and rough draft,<br/>then click <strong style={{ color:"#6B7280" }}>Polish My Email</strong> to see<br/>your professional version here.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LESSON PLAN GENERATOR TOOL
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const LP_DURATIONS = ["30 minutes","45 minutes","60 minutes","75 minutes","90 minutes","2 hours","Block (2.5 hrs)"];
const LP_MODELS    = ["Direct Instruction","Gradual Release (I Do / We Do / You Do)","Project-Based Learning","Inquiry / Discovery","Flipped Classroom","Cooperative Learning","Workshop Model","Socratic Seminar"];
const LP_DIFF      = ["ELL / Language Learners","Students with IEPs","Gifted & Advanced","504 Accommodations","Multiple Learning Styles","Neurodiverse Students (Autism / Multiple Disabilities)"];

function LessonPlanGenerator() {
  const BRAND = "#CF27F5";
  const LIGHT  = "#FDF4FF";

  const [form, setForm] = useState({
    grade:"k", subject:"", topic:"", duration:"45 minutes", model:"Direct Instruction",
    objectives:"", materials:"", standard:"", diff:[], notes:"",
  });
  const [result, setResult]       = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState(null);
  const [copied, setCopied]       = useState(false);
  const [showCopyBox, setShowCopyBox] = useState(false);
  const [showGdocsBox, setShowGdocsBox] = useState(false);
  const [showStdPicker, setShowStdPicker] = useState(false);

  // AI Idea Helper
  const [aiHelperOpen, setAiHelperOpen] = useState(false);
  const [aiHelperField, setAiHelperField] = useState("objectives"); // which field to fill
  const [aiHelperLoading, setAiHelperLoading] = useState(false);
  const [aiHelperResult, setAiHelperResult]   = useState("");

  // Exemplar
  const [exMode, setExMode]           = useState("file");
  const [exemplarFile, setExemplarFile] = useState(null);
  const [exemplarUrl, setExemplarUrl]   = useState("");
  const [exemplarText, setExemplarText] = useState("");
  const [exemplarDesc, setExemplarDesc] = useState("");
  const [exemplarRaw,  setExemplarRaw]  = useState(""); // full text extracted from file/url/paste
  const [analyzingEx, setAnalyzingEx]   = useState(false);
  const [exError, setExError]           = useState("");
  const dropRef                         = useRef(null);
  const [draggingOver, setDraggingOver] = useState(false);

  const setF = (k,v) => setForm(p => ({...p,[k]:v}));
  const toggleDiff = (d) => setF("diff", form.diff.includes(d) ? form.diff.filter(x=>x!==d) : [...form.diff, d]);

  // ── Shared Claude call ─────────────────────────────────────────────
  const callClaude = async (system, userContent, maxTokens = 600) => {
    const res = await fetch("https://iaklmdnlwjgguhkixvio.supabase.co/functions/v1/anthropic-proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: userContent }],
      }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e?.error?.message || `API error ${res.status}`);
    }
    const data = await res.json();
    if (data.error) throw new Error(data.error.message);
    return data.content?.map(b => b.text || "").join("") || "";
  };

  // ── AI Idea Helper ─────────────────────────────────────────────────
  const runAiHelper = async () => {
    if (!form.subject.trim() && !form.topic.trim()) { setAiHelperResult("Please fill in at least a subject or topic first."); return; }
    setAiHelperLoading(true); setAiHelperResult("");
    const fieldLabels = {
      objectives: "3 specific SWBAT learning objectives",
      materials:  "a list of materials and resources needed",
      notes:      "teacher preparation notes, tips, and things to watch out for",
    };
    try {
      const text = await callClaude(
        "You are a helpful curriculum assistant. Respond concisely and practically — no preamble.",
        `Generate ${fieldLabels[aiHelperField]} for a ${form.grade} grade ${form.subject || "ELA"} lesson on "${form.topic || form.subject}". Model: ${form.model}. Duration: ${form.duration}. Be specific and ready to use.`,
        500
      );
      setAiHelperResult(text);
    } catch(e) { setAiHelperResult(`Error: ${e.message}`); }
    setAiHelperLoading(false);
  };

  const applyAiHelper = () => {
    if (!aiHelperResult) return;
    setF(aiHelperField, aiHelperResult);
    setAiHelperResult("");
  };

  // ── Exemplar handlers ──────────────────────────────────────────────
  const readFileAsB64  = f => new Promise((res,rej) => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsDataURL(f); });
  const readFileAsText = f => new Promise((res,rej) => { const r=new FileReader(); r.onload=e=>res(e.target.result); r.onerror=rej; r.readAsText(f); });

  const ANALYZE_Q = "Analyze this exemplar lesson plan. In 3 sentences describe: (1) sections and their order, (2) level of detail, (3) formatting style (bullets/tables/numbered steps). This will guide format replication.";

  const extractPdfText = async (file) => {
    // Lazy-load pdfjs only when needed; configure the worker from the same package.
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    const buf = await file.arrayBuffer();
    const doc = await pdfjs.getDocument({ data: buf }).promise;
    const pages = Math.min(doc.numPages, 15); // cap pages to keep prompt small
    let text = "";
    for (let p = 1; p <= pages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n\n";
    }
    return text.trim();
  };

  const extractDocxText = async (file) => {
    const mammoth = await import("mammoth/mammoth.browser.js");
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return (result.value || "").trim();
  };

  const handleExemplarFile = async (file) => {
    if (!file) return;
    setExError(""); setExemplarDesc(""); setAnalyzingEx(true);
    try {
      const isImage = file.type.startsWith("image/");
      const isPdf   = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
      const isDocx  = /\.docx$/i.test(file.name) || file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      const isTxt   = /\.(txt|md|rtf)$/i.test(file.name) || file.type === "text/plain";
      let preview = null;
      let desc = "";
      let raw  = "";
      if (isImage) {
        const dataUrl = await readFileAsB64(file);
        preview = dataUrl;
        const b64 = dataUrl.split(",")[1];
        desc = await callClaude(
          "Analyze lesson plan images briefly.",
          [{ type:"image", source:{ type:"base64", media_type:file.type, data:b64 } }, { type:"text", text:ANALYZE_Q }]
        );
      } else if (isPdf) {
        raw = await extractPdfText(file);
        if (!raw) throw new Error("Could not read text from PDF (it may be scanned images). Try the Paste Text tab.");
        desc = await callClaude("Analyze lesson plan text briefly.", `${ANALYZE_Q}\n\nPLAN:\n${raw.slice(0,8000)}`);
      } else if (isDocx) {
        raw = await extractDocxText(file);
        if (!raw) throw new Error("Could not read text from this Word document. Try the Paste Text tab.");
        desc = await callClaude("Analyze lesson plan text briefly.", `${ANALYZE_Q}\n\nPLAN:\n${raw.slice(0,8000)}`);
      } else if (isTxt) {
        raw = await readFileAsText(file);
        desc = await callClaude("Analyze lesson plan text briefly.", `${ANALYZE_Q}\n\nPLAN:\n${raw.slice(0,8000)}`);
      } else {
        desc = `"${file.name}" uploaded but its format isn't supported here. Try uploading a PDF, DOCX, image, or paste the text.`;
      }
      setExemplarFile({ name:file.name, preview });
      setExemplarDesc(desc);
      setExemplarRaw(raw);
    } catch(e) { setExError(`Could not analyze: ${e.message}. Try the Paste Text tab.`); }
    setAnalyzingEx(false);
  };

  const handleUrlAnalyze = async () => {
    const url = exemplarUrl.trim();
    if (!url) return;
    setExError(""); setExemplarDesc(""); setExemplarRaw(""); setAnalyzingEx(true);
    if (/docs\.google\.com/.test(url)) {
      setExemplarDesc("Google Docs: File → Download → Plain Text (.txt) then upload — or Select All, Copy, and use the Paste Text tab.");
      setAnalyzingEx(false); return;
    }
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const desc = await callClaude("Analyze lesson plan text briefly.", `${ANALYZE_Q}\n\nCONTENT:\n${text.slice(0,8000)}`);
      setExemplarDesc(desc);
      setExemplarRaw(text);
    } catch(e) { setExError(`Could not load URL: ${e.message}. Try the Paste Text tab.`); }
    setAnalyzingEx(false);
  };

  const handleTextAnalyze = async () => {
    if (!exemplarText.trim()) return;
    setExError(""); setExemplarDesc(""); setAnalyzingEx(true);
    try {
      const desc = await callClaude("Analyze lesson plan text briefly.", `${ANALYZE_Q}\n\nPLAN:\n${exemplarText.slice(0,8000)}`);
      setExemplarDesc(desc);
      setExemplarRaw(exemplarText);
    } catch(e) { setExError(`Analysis failed: ${e.message}`); }
    setAnalyzingEx(false);
  };

  const clearExemplar = () => { setExemplarFile(null); setExemplarUrl(""); setExemplarText(""); setExemplarDesc(""); setExemplarRaw(""); setExError(""); setAnalyzingEx(false); };
  const handleDrop = (e) => { e.preventDefault(); setDraggingOver(false); const f = e.dataTransfer.files?.[0]; if (f) { setExMode("file"); handleExemplarFile(f); } };

  // ── MAIN GENERATE ─────────────────────────────────────────────────
  const generate = async () => {
    if (!form.subject.trim() || !form.topic.trim()) {
      setError("Please fill in Subject and Topic before generating.");
      return;
    }
    setLoading(true);
    setResult(null);
    setError(null);

    const diffList = form.diff.length ? form.diff.join(", ") : "General education";
    const isGradualRelease = form.model.toLowerCase().includes("gradual");
    const isNeurodiverse = form.diff.includes("Neurodiverse Students (Autism / Multiple Disabilities)");

    // Concise per-need instructions — no bullet points or special chars that bloat JSON responses
    const diffNotes = [];
    if (form.diff.includes("ELL / Language Learners")) diffNotes.push("ELL: use simple sentences, visual word banks, sentence frames, picture labels on materials");
    if (form.diff.includes("Students with IEPs")) diffNotes.push("IEP: align to IEP goals, offer modified tasks, break directions into single steps, allow alternative ways to show mastery");
    if (form.diff.includes("504 Accommodations")) diffNotes.push("504: extended time, reduced-distraction workspace, movement breaks, chunked tasks, written and verbal directions");
    if (form.diff.includes("Gifted & Advanced")) diffNotes.push("Gifted: enrichment tasks, open-ended inquiry, primary sources, opportunities for peer teaching");
    if (form.diff.includes("Multiple Learning Styles")) diffNotes.push("Multiple Learning Styles: include visual, auditory, and kinesthetic activities; offer student choice in how they demonstrate learning");
    if (isNeurodiverse) diffNotes.push("Neurodiverse (Autism/Multiple Disabilities): simplify language to short concrete phrases, use field-of-3 picture choices for responses, embed visual aids in every section, allow AAC devices and assistive technology as primary response modes, no independent writing required, use real objects and tactile materials, include sensory breaks, connect all content to concrete real-world examples");

    const diffSection = diffNotes.length > 0
      ? "Differentiation strategies to embed throughout every lesson section: " + diffNotes.join(" | ")
      : "No specific differentiation required.";

    const sectionNames = isGradualRelease
      ? "Do Now/Hook, I Do-Modeling, We Do-Guided Practice, You Do-Independent Practice, Closure"
      : "Do Now/Hook, Direct Instruction, Guided Practice, Independent Work, Closure";

    const extras = [
      form.objectives ? `Objectives: ${form.objectives}` : "",
      form.materials  ? `Materials: ${form.materials}` : "",
      form.notes.trim() ? `Teacher notes: ${form.notes}` : "",
      exemplarDesc ? `Format analysis of teacher's exemplar: ${exemplarDesc.slice(0, 600)}` : "",
      exemplarRaw  ? `Exemplar lesson plan to mimic in structure, tone, and section detail (replicate this format closely):\n${exemplarRaw.slice(0, 4000)}` : "",
    ].filter(Boolean).join("\n");

    const systemPrompt = `You are an expert NY State curriculum designer. Respond with ONLY a valid JSON object. No markdown, no code fences, no text outside the JSON. Start with { and end with }. Keep all field values concise — under 80 words each — so the full response fits within the token limit. CRITICAL: Always provide a real, concrete homework activity AND a real, concrete extension activity. Never write "N/A", "None", "Not applicable", or leave them blank — even for Kindergarten, propose a developmentally-appropriate at-home family activity (e.g. drawing, sorting objects at home, reading with a caregiver) for homework, and a deeper challenge or enrichment task for extension.`;

    const userPrompt = `Create a lesson plan for:
Grade: ${form.grade} | Subject: ${form.subject} | Topic: ${form.topic}
Duration: ${form.duration} | Model: ${form.model}
Standard: ${form.standard || "Select the most relevant NYS standard"}
Differentiation: ${diffList}
${diffSection}
Sections: ${sectionNames}
${extras}

REQUIRED for homework and extension:
- "homework" MUST be a specific, grade-appropriate at-home activity tied to today's objective. For Kindergarten and early grades, suggest a short hands-on family activity (10-15 min) such as drawing, sorting household objects, reading aloud with a caregiver, or a scavenger hunt. NEVER write "N/A" or "None".
- "extension" MUST be a specific enrichment / challenge activity for students who finish early or need a deeper push. NEVER write "N/A" or "None".

Return this JSON (replace all placeholder text with real content, keep values concise):
{
  "title": "...",
  "gradeSubject": "...",
  "duration": "...",
  "standard": "...",
  "objectives": ["...", "...", "..."],
  "materials": ["...", "...", "..."],
  "vocabulary": ["...", "...", "..."],
  "sections": [
    {"name": "...", "duration": "...", "description": "...", "teacherMoves": "...", "studentActions": "...", "udlNotes": "..."}
  ],
  "assessment": {"formative": "...", "summative": "...", "exitTicket": "..."},
  "differentiation": {"ell": "...", "iep": "...", "gifted": "...", "universal": "..."},
  "homework": "...",
  "extension": "...",
  "teacherNotes": "..."
}`;

    try {
      const raw = await callClaude(systemPrompt, userPrompt, 4000);
      if (!raw || !raw.trim()) throw new Error("No response received. Please try again.");

      // Strip any accidental fences
      let clean = raw.trim();
      if (clean.startsWith("```")) {
        clean = clean.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
      }

      // Find the JSON object boundaries
      const start = clean.indexOf("{");
      const end   = clean.lastIndexOf("}");
      if (start === -1 || end === -1) throw new Error("Response was not valid JSON. Please try again.");
      clean = clean.slice(start, end + 1);

      const parsed = JSON.parse(clean);

      // Scrub "N/A"-style answers from homework/extension and ask AI to retry just those if needed
      const isEmpty = v => !v || /^(n\/?a|none|not applicable|tbd|n\.a\.?)\.?$/i.test(String(v).trim());
      if (isEmpty(parsed.homework) || isEmpty(parsed.extension)) {
        try {
          const fixPrompt = `For a ${form.grade} ${form.subject} lesson on "${form.topic}" (${form.duration}), suggest:
1. ONE specific, grade-appropriate homework activity (10-15 min, family-friendly for early grades)
2. ONE specific extension/enrichment activity for students who need a deeper challenge
Return ONLY this JSON: {"homework":"...","extension":"..."}`;
          const fixRaw = await callClaude("Return only valid JSON.", fixPrompt, 400);
          const fStart = fixRaw.indexOf("{"), fEnd = fixRaw.lastIndexOf("}");
          if (fStart !== -1 && fEnd !== -1) {
            const fixObj = JSON.parse(fixRaw.slice(fStart, fEnd + 1));
            if (!isEmpty(fixObj.homework))  parsed.homework  = fixObj.homework;
            if (!isEmpty(fixObj.extension)) parsed.extension = fixObj.extension;
          }
        } catch(_) { /* fall through with whatever we have */ }
      }

      setResult(parsed);
    } catch (e) {
      setError(`Generation failed: ${e.message}`);
    }
    setLoading(false);
  };

  const buildPlanText = () => {
    if (!result) return "";
    return [
      `LESSON PLAN: ${result.title}`,
      `${result.gradeSubject} | ${result.duration}`,
      `Standard: ${result.standard}`, "",
      "OBJECTIVES:", ...(result.objectives||[]).map(o=>`  - ${o}`), "",
      "MATERIALS:", ...(result.materials||[]).map(m=>`  - ${m}`), "",
      "KEY VOCABULARY:", (result.vocabulary||[]).join(", "), "",
      ...(result.sections||[]).flatMap(s=>[
        `=== ${s.name.toUpperCase()} (${s.duration}) ===`,
        s.description, `Teacher: ${s.teacherMoves}`, `Students: ${s.studentActions}`,
        s.udlNotes?`UDL: ${s.udlNotes}`:"", ""
      ]),
      "ASSESSMENT:",
      `  Formative: ${result.assessment?.formative||""}`,
      `  Exit Ticket: ${result.assessment?.exitTicket||""}`,
      `  Summative: ${result.assessment?.summative||""}`, "",
      "DIFFERENTIATION:",
      `  ELL: ${result.differentiation?.ell||""}`,
      `  IEP: ${result.differentiation?.iep||""}`,
      `  Gifted: ${result.differentiation?.gifted||""}`,
      `  Universal: ${result.differentiation?.universal||""}`, "",
      `HOMEWORK: ${result.homework||""}`, "",
      `TEACHER NOTES: ${result.teacherNotes||""}`
    ].join("\n");
  };

  // Copy: show selectable text box as fallback (works in all iframes/CSP)
  const copyPlan = async () => {
    if (!result) return;
    const text = buildPlanText();
    let success = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        success = true;
      }
    } catch(e) {}
    if (!success) {
      // execCommand fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = text; ta.style.cssText = "position:fixed;opacity:0;top:0;left:0";
        document.body.appendChild(ta); ta.select();
        success = document.execCommand("copy");
        document.body.removeChild(ta);
      } catch(e) {}
    }
    if (success) {
      setCopied(true); setTimeout(()=>setCopied(false), 2500);
    } else {
      // Final fallback: show selectable text box
      setShowCopyBox(true);
    }
  };

  // Print: write into a hidden iframe to avoid popup blockers and blob: CSP issues
  const printPlan = () => {
    if (!result) return;
    const safeHtml = s => String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const sectionColors = ["#1E3A5F","#CF27F5","#0369A1","#B45309","#374151","#166534"];
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${safeHtml(result.title)}</title>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:32px;color:#111;max-width:820px}
h1{color:#CF27F5;font-size:22px;margin-bottom:4px}
.meta{font-size:12px;color:#666;margin-bottom:12px}
.std{background:#fdf4ff;border-left:4px solid #CF27F5;padding:8px 12px;font-size:12px;margin-bottom:16px}
h2{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#666;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:3px}
ul{padding-left:16px}li{margin-bottom:3px;font-size:12px}
.sec{margin-bottom:12px;border-radius:4px;overflow:hidden;border:1px solid #ddd;page-break-inside:avoid}
.sec-h{padding:6px 12px;color:white;font-weight:700;font-size:11px;display:flex;justify-content:space-between}
.sec-b{padding:10px 12px;font-size:12px;line-height:1.5}
.sec-b p{margin:0 0 4px}
.g2{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:6px}
.g3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-top:6px}
.box{background:#f9f9f9;border:1px solid #ddd;border-radius:4px;padding:8px 10px}
.box-l{font-size:9px;font-weight:700;text-transform:uppercase;color:#CF27F5;margin-bottom:3px}
.box p{font-size:11px;color:#333}
.hw{background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;padding:10px 12px;font-size:12px;margin-bottom:10px}
.notes{background:#fefce8;border:1px solid #fde68a;border-radius:4px;padding:10px 12px;font-size:12px}
@media print{@page{margin:1.5cm}body{padding:0}}</style></head><body>
<h1>${safeHtml(result.title)}</h1>
<div class="meta">${safeHtml(result.gradeSubject)} | ${safeHtml(result.duration)}</div>
<div class="std"><strong>Standard:</strong> ${safeHtml(result.standard)}</div>
<h2>Objectives</h2><ul>${(result.objectives||[]).map(o=>`<li>${safeHtml(o)}</li>`).join("")}</ul>
<div class="g2"><div><h2 style="margin-top:0">Materials</h2><ul>${(result.materials||[]).map(m=>`<li>${safeHtml(m)}</li>`).join("")}</ul></div>
<div><h2 style="margin-top:0">Key Vocabulary</h2><p style="font-size:12px">${(result.vocabulary||[]).map(v=>safeHtml(v)).join(" · ")}</p></div></div>
<h2>Lesson Sequence</h2>
${(result.sections||[]).map((s,i)=>`<div class="sec"><div class="sec-h" style="background:${sectionColors[i]||"#374151"}"><span>${safeHtml(s.name)}</span><span style="opacity:0.75;font-weight:400">${safeHtml(s.duration)}</span></div><div class="sec-b"><p>${safeHtml(s.description)}</p><p><strong>Teacher:</strong> ${safeHtml(s.teacherMoves)}</p><p><strong>Students:</strong> ${safeHtml(s.studentActions)}</p>${s.udlNotes?`<p style="color:#0369A1;font-size:11px">UDL: ${safeHtml(s.udlNotes)}</p>`:""}</div></div>`).join("")}
<h2>Assessment</h2><div class="g3">
<div class="box"><div class="box-l">Formative</div><p>${safeHtml(result.assessment?.formative)}</p></div>
<div class="box"><div class="box-l">Exit Ticket</div><p>${safeHtml(result.assessment?.exitTicket)}</p></div>
<div class="box"><div class="box-l">Summative</div><p>${safeHtml(result.assessment?.summative)}</p></div></div>
<h2>Differentiation</h2><div class="g2">
<div class="box"><div class="box-l">ELL</div><p>${safeHtml(result.differentiation?.ell)}</p></div>
<div class="box"><div class="box-l">IEP</div><p>${safeHtml(result.differentiation?.iep)}</p></div>
<div class="box"><div class="box-l">Gifted</div><p>${safeHtml(result.differentiation?.gifted)}</p></div>
<div class="box"><div class="box-l">Universal Design</div><p>${safeHtml(result.differentiation?.universal)}</p></div></div>
${result.homework?`<h2>Homework</h2><div class="hw">${safeHtml(result.homework)}</div>`:""}
${result.teacherNotes?`<h2>Teacher Notes</h2><div class="notes">${safeHtml(result.teacherNotes)}</div>`:""}
<script>window.onload=function(){window.print()}<\/script>
</body></html>`;

    // Use hidden iframe — avoids popup blockers AND blob: CSP restrictions
    let iframe = document.getElementById("__lp_print_frame__");
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.id = "__lp_print_frame__";
      iframe.style.cssText = "position:fixed;width:0;height:0;opacity:0;border:none;top:0;left:0";
      document.body.appendChild(iframe);
    }
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(()=>{ try{ iframe.contentWindow.focus(); iframe.contentWindow.print(); }catch(e){ alert("Print blocked by browser. Please use Ctrl+P / Cmd+P to print."); } }, 600);
  };

  // Google Docs: write text into a visible textarea the user can select-all + copy,
  // then link them to docs.new — no blob URLs needed, works in all CSP environments
  const exportToGoogleDocs = () => {
    if (!result) return;
    setShowGdocsBox(true);
    setShowCopyBox(false);
  };

  // Inline Standards Picker for lesson plan
  const [stdSubj, setStdSubj] = useState("ELA");
  const [stdBand, setStdBand] = useState("Kindergarten");
  const [stdSearch, setStdSearch] = useState("");
  const stdBands = Object.keys(NY_STANDARDS[stdSubj] || {});
  const stdList  = (NY_STANDARDS[stdSubj]?.[stdBand] || []).filter(s =>
    !stdSearch.trim() || s.code.toLowerCase().includes(stdSearch.toLowerCase()) || s.desc.toLowerCase().includes(stdSearch.toLowerCase())
  );

  const lbl = { fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#6B7280", display:"block", marginBottom:5 };
  const inp = { width:"100%", padding:"9px 11px", borderRadius:7, border:"1.5px solid #D1D5DB", fontFamily:"'Inter',sans-serif", fontSize:13, color:"#111827", outline:"none", boxSizing:"border-box", background:"white" };

  return (
    <div style={{ padding:"28px 32px", maxWidth:1200, margin:"0 auto", display:"grid", gridTemplateColumns:"360px 1fr", gap:28, alignItems:"start" }}>

      {/* LEFT: Form */}
      <div style={{ background:"white", borderRadius:10, border:"1px solid #E5E7EB", overflow:"hidden" }}>
        <div style={{ background:BRAND, padding:"12px 18px" }}>
          <span style={{ fontFamily:"'Playfair Display',serif", color:"white", fontSize:15, fontWeight:700 }}>📋  Lesson Details</span>
        </div>
        <div style={{ padding:"18px 18px 22px" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:14 }}>
            <div>
              <label style={lbl}>Grade</label>
              <select value={form.grade} onChange={e => setF("grade",e.target.value)} style={{ ...inp, cursor:"pointer" }}>
                {GRADES.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Duration</label>
              <select value={form.duration} onChange={e => setF("duration",e.target.value)} style={{ ...inp, cursor:"pointer" }}>
                {LP_DURATIONS.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Subject</label>
            <input type="text" value={form.subject} onChange={e => setF("subject",e.target.value)} spellCheck placeholder="e.g. ELA, Mathematics, Science…" style={inp} />
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Lesson Topic / Title</label>
            <input type="text" value={form.topic} onChange={e => setF("topic",e.target.value)} spellCheck placeholder="e.g. Introduction to Fractions" style={inp} />
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Instructional Model</label>
            <select value={form.model} onChange={e => setF("model",e.target.value)} style={{ ...inp, cursor:"pointer" }}>
              {LP_MODELS.map(m => <option key={m}>{m}</option>)}
            </select>
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Learning Objectives (optional — AI will suggest if blank)</label>
            <textarea value={form.objectives} onChange={e => setF("objectives",e.target.value)} spellCheck placeholder="Students will be able to…" style={{ ...inp, minHeight:72, resize:"vertical", lineHeight:1.6 }} />
          </div>

          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Materials (optional)</label>
            <textarea value={form.materials} onChange={e => setF("materials",e.target.value)} spellCheck placeholder="Textbooks, manipulatives, handouts…" style={{ ...inp, minHeight:56, resize:"vertical", lineHeight:1.6 }} />
          </div>

          {/* NY Standard Picker */}
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>NY State Standard</label>
            {form.standard ? (
              <div style={{ display:"flex", gap:8, alignItems:"flex-start" }}>
                <div style={{ flex:1, background:LIGHT, border:`1.5px solid ${BRAND}`, borderRadius:7, padding:"8px 11px", fontSize:12, color:"#111827", lineHeight:1.4 }}>{form.standard}</div>
                <button onClick={() => { setF("standard",""); setShowStdPicker(false); }} style={{ padding:"6px 9px", borderRadius:6, border:"1.5px solid #FCA5A5", background:"#FEF2F2", color:"#DC2626", cursor:"pointer", fontFamily:"'Inter',sans-serif", fontSize:11, fontWeight:700, whiteSpace:"nowrap" }}>✕ Clear</button>
              </div>
            ) : (
              <button onClick={() => setShowStdPicker(p=>!p)}
                style={{ width:"100%", padding:"9px 12px", borderRadius:7, border:`1.5px dashed ${BRAND}`, background:LIGHT, color:BRAND, fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer" }}>
                {showStdPicker ? "▲ Hide Standards" : "🗽 Browse NY Standards"}
              </button>
            )}

            {showStdPicker && !form.standard && (
              <div style={{ marginTop:10, border:"1.5px solid #E5E7EB", borderRadius:8, overflow:"hidden" }}>
                <div style={{ padding:"10px 12px", background:"#F9FAFB", borderBottom:"1px solid #E5E7EB", display:"flex", gap:8, flexWrap:"wrap" }}>
                  <select value={stdSubj} onChange={e => { const s = e.target.value; setStdSubj(s); setStdBand(s === "ELA" ? "Kindergarten" : Object.keys(NY_STANDARDS[s]||{})[0]||""); }} style={{ ...inp, flex:1, padding:"6px 8px", fontSize:12 }}>
                    {Object.keys(NY_STANDARDS).map(s => <option key={s}>{s}</option>)}
                  </select>
                  <select value={stdBand} onChange={e => setStdBand(e.target.value)} style={{ ...inp, flex:1, padding:"6px 8px", fontSize:12 }}>
                    {stdBands.map(b => <option key={b}>{b}</option>)}
                  </select>
                  <input type="text" value={stdSearch} onChange={e => setStdSearch(e.target.value)} placeholder="Search…" style={{ ...inp, flex:2, padding:"6px 8px", fontSize:12 }} />
                </div>
                <div style={{ maxHeight:200, overflowY:"auto" }}>
                  {stdList.map((s,i) => (
                    <button key={i} onClick={() => { setF("standard", `${s.code}: ${s.desc}`); setShowStdPicker(false); setStdSearch(""); }}
                      style={{ display:"block", width:"100%", textAlign:"left", padding:"9px 12px", border:"none", borderBottom:"1px solid #F3F4F6", background:"white", cursor:"pointer", transition:"background 0.1s" }}
                      onMouseEnter={e => e.currentTarget.style.background = LIGHT}
                      onMouseLeave={e => e.currentTarget.style.background = "white"}>
                      <div style={{ fontSize:10, fontWeight:700, color:BRAND, textTransform:"uppercase", letterSpacing:0.5, marginBottom:2 }}>{s.code}</div>
                      <div style={{ fontSize:12, color:"#374151", lineHeight:1.4 }}>{s.desc}</div>
                    </button>
                  ))}
                  {stdList.length === 0 && <p style={{ padding:"14px 12px", fontSize:12, color:"#9CA3AF", margin:0 }}>No standards match.</p>}
                </div>
              </div>
            )}
          </div>

          {/* Exemplar Upload */}
          <div style={{ marginBottom:18 }}>
            <label style={lbl}>Exemplar / Format Template <span style={{ fontWeight:500, textTransform:"none", letterSpacing:0, color:"#9CA3AF" }}>(optional)</span></label>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:"#9CA3AF", margin:"0 0 10px", lineHeight:1.5 }}>
              Share a lesson plan you love as a format guide — the AI will match its structure.
            </p>

            {/* Tab switcher */}
            <div style={{ display:"flex", gap:0, marginBottom:10, border:"1.5px solid #E5E7EB", borderRadius:8, overflow:"hidden" }}>
              {[["file","📎 File / Image"],["url","🔗 Google Doc / URL"],["text","📋 Paste Text"]].map(([id, lbl]) => (
                <button key={id} onClick={() => { setExMode(id); clearExemplar(); }}
                  style={{ flex:1, padding:"8px 4px", border:"none", borderRight:id!=="text"?"1px solid #E5E7EB":"none", background: exMode===id ? BRAND : "white", color: exMode===id ? "white" : "#374151", fontFamily:"'Inter',sans-serif", fontWeight: exMode===id ? 700 : 500, fontSize:11.5, cursor:"pointer", transition:"all 0.12s", whiteSpace:"nowrap" }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* ── Shared: analyzed result ── */}
            {(exemplarDesc || analyzingEx) && (
              <div style={{ border:`1.5px solid ${BRAND}40`, borderRadius:8, overflow:"hidden", background:LIGHT, marginBottom:8 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 12px", borderBottom: exemplarDesc ? "1px solid #E5E7EB" : "none" }}>
                  <div style={{ width:34, height:34, borderRadius:6, background:"white", border:"1px solid #E5E7EB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, flexShrink:0 }}>
                    {exemplarFile?.preview ? <img src={exemplarFile.preview} alt="" style={{ width:34, height:34, objectFit:"cover", borderRadius:5 }} /> : "📄"}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, color:"#111827" }}>
                      {exemplarFile?.name || (exMode==="url" ? "Google Doc / URL" : "Pasted text")}
                    </div>
                    <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color: analyzingEx ? BRAND : "#6B7280", marginTop:2 }}>
                      {analyzingEx ? "⚡ Analyzing structure…" : "✓ Format analyzed — ready to use"}
                    </div>
                  </div>
                  <button onClick={clearExemplar}
                    style={{ width:24, height:24, borderRadius:"50%", border:"1.5px solid #FCA5A5", background:"#FEF2F2", color:"#DC2626", cursor:"pointer", fontWeight:800, fontSize:11, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>✕</button>
                </div>
                {analyzingEx && (
                  <div style={{ padding:"10px 12px", display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:13, height:13, border:`2px solid ${BRAND}30`, borderTopColor:BRAND, borderRadius:"50%", animation:"spin 0.8s linear infinite", flexShrink:0 }} />
                    <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:"#9CA3AF" }}>Reading format and structure…</span>
                  </div>
                )}
                {exemplarDesc && !analyzingEx && (
                  <div style={{ padding:"10px 12px" }}>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:"#374151", margin:0, lineHeight:1.6 }}>{exemplarDesc}</p>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: File Upload ── */}
            {exMode === "file" && !exemplarDesc && !analyzingEx && (
              <label
                ref={dropRef}
                onDragOver={e => { e.preventDefault(); setDraggingOver(true); }}
                onDragLeave={() => setDraggingOver(false)}
                onDrop={handleDrop}
                style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:8, padding:"18px 14px", borderRadius:8, border:`2px dashed ${draggingOver ? BRAND : "#D1D5DB"}`, background: draggingOver ? LIGHT : "#FAFAFA", cursor:"pointer", transition:"all 0.15s", textAlign:"center" }}>
                <span style={{ fontSize:26 }} aria-hidden="true">📎</span>
                <div>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, color: draggingOver ? BRAND : "#374151" }}>
                    {draggingOver ? "Drop it here!" : "Drop your exemplar here"}
                  </div>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:"#9CA3AF", marginTop:3 }}>
                    or click to browse
                  </div>
                  <div style={{ fontFamily:"'Inter',sans-serif", fontSize:10.5, color:"#D1D5DB", marginTop:4 }}>
                    Supports: PNG, JPG, PDF, Word (.docx), Text (.txt)
                  </div>
                </div>
                <input type="file" accept="image/*,.pdf,.doc,.docx,.txt,.md,.rtf" aria-label="Upload exemplar lesson plan"
                  onChange={e => e.target.files[0] && handleExemplarFile(e.target.files[0])} style={{ display:"none" }} />
              </label>
            )}

            {/* ── Tab: Google Doc / URL ── */}
            {exMode === "url" && !exemplarDesc && !analyzingEx && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <div style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:"#374151", lineHeight:1.6, background:"#FFFBEB", border:"1px solid #FDE68A", borderRadius:7, padding:"10px 12px" }}>
                  <strong>📋 Google Docs (recommended steps):</strong><br/>
                  1. Open your Google Doc<br/>
                  2. <strong>File → Download → Plain Text (.txt)</strong><br/>
                  3. Upload that file using the <strong>📎 File/Image</strong> tab<br/><br/>
                  <em>— or —</em><br/><br/>
                  Select All → Copy → paste into the <strong>📋 Paste Text</strong> tab.<br/><br/>
                  <strong>Other URLs</strong> (non-Google): paste below and click Analyze.
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  <input type="url" value={exemplarUrl} onChange={e => { setExemplarUrl(e.target.value); setExError(""); }}
                    placeholder="https://… (non-Google Doc URLs)"
                    onKeyDown={e => e.key === "Enter" && handleUrlAnalyze()}
                    style={{ flex:1, padding:"9px 11px", borderRadius:7, border:"1.5px solid #D1D5DB", fontFamily:"'Inter',sans-serif", fontSize:13, color:"#111827", outline:"none" }} />
                  <button onClick={handleUrlAnalyze} disabled={!exemplarUrl.trim()}
                    style={{ padding:"9px 14px", borderRadius:7, border:"none", background: exemplarUrl.trim() ? BRAND : "#E5E7EB", color: exemplarUrl.trim() ? "white" : "#9CA3AF", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, cursor: exemplarUrl.trim() ? "pointer" : "not-allowed", whiteSpace:"nowrap" }}>
                    Analyze →
                  </button>
                </div>
                {exError && <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:"#DC2626", margin:0, lineHeight:1.5 }}>{exError}</p>}
              </div>
            )}

            {/* ── Tab: Paste Text ── */}
            {exMode === "text" && !exemplarDesc && !analyzingEx && (
              <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                <textarea value={exemplarText} onChange={e => { setExemplarText(e.target.value); setExError(""); }}
                  placeholder="Paste your exemplar lesson plan text here — from Google Docs, Word, Notion, or anywhere else…"
                  style={{ width:"100%", minHeight:120, padding:"10px 12px", borderRadius:7, border:"1.5px solid #D1D5DB", fontFamily:"'Inter',sans-serif", fontSize:12.5, color:"#111827", outline:"none", resize:"vertical", lineHeight:1.6, boxSizing:"border-box" }} />
                <button onClick={handleTextAnalyze} disabled={!exemplarText.trim()}
                  style={{ padding:"9px 14px", borderRadius:7, border:"none", background: exemplarText.trim() ? BRAND : "#E5E7EB", color: exemplarText.trim() ? "white" : "#9CA3AF", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, cursor: exemplarText.trim() ? "pointer" : "not-allowed" }}>
                  Analyze Format →
                </button>
                {exError && <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:"#DC2626", margin:0 }}>{exError}</p>}
              </div>
            )}
          </div>

          {/* Differentiation */}
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Differentiation (select all that apply)</label>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:"#9CA3AF", margin:"0 0 8px", lineHeight:1.5 }}>
              Selected needs are woven into every section of the generated lesson.
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:6, marginTop:4 }}>
              {LP_DIFF.map(d => (
                <label key={d} style={{ display:"flex", alignItems:"center", gap:9, cursor:"pointer" }}>
                  <input type="checkbox" checked={form.diff.includes(d)} onChange={() => toggleDiff(d)} style={{ accentColor:BRAND, width:15, height:15 }} />
                  <span style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#374151" }}>{d}</span>
                </label>
              ))}
            </div>
          </div>

          {/* AI Idea Helper */}
          <div style={{ marginBottom:14, border:"1.5px solid #E5E7EB", borderRadius:9, overflow:"hidden" }}>
            <button onClick={() => setAiHelperOpen(v => !v)}
              style={{ width:"100%", padding:"10px 14px", border:"none", background: aiHelperOpen ? BRAND : "#F9FAFB", color: aiHelperOpen ? "white" : "#374151", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, cursor:"pointer", display:"flex", alignItems:"center", gap:8, textAlign:"left" }}>
              <span style={{ fontSize:16 }}>🤖</span>
              <span>AI Idea Helper — Get suggestions for your lesson</span>
              <span style={{ marginLeft:"auto", fontSize:11 }}>{aiHelperOpen ? "▲" : "▼"}</span>
            </button>
            {aiHelperOpen && (
              <div style={{ padding:"12px 14px", background:"white" }}>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"#6B7280", margin:"0 0 10px", lineHeight:1.5 }}>
                  Ask AI to help you fill in a field. Fill in Subject and Topic first for best results.
                </p>
                <label style={{ ...lbl, marginTop:0 }}>Generate ideas for:</label>
                <div style={{ display:"flex", gap:6, marginTop:4, marginBottom:10, flexWrap:"wrap" }}>
                  {[["objectives","Learning Objectives"],["materials","Materials"],["notes","Teacher Notes"]].map(([id,lbl2]) => (
                    <button key={id} onClick={() => setAiHelperField(id)}
                      style={{ padding:"5px 12px", borderRadius:6, border:`1.5px solid ${aiHelperField===id ? BRAND : "#E5E7EB"}`, background: aiHelperField===id ? LIGHT : "white", color: aiHelperField===id ? BRAND : "#374151", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                      {lbl2}
                    </button>
                  ))}
                </div>
                <button onClick={runAiHelper} disabled={aiHelperLoading}
                  style={{ width:"100%", padding:"8px", borderRadius:7, border:"none", background: aiHelperLoading ? "#E5E7EB" : BRAND, color: aiHelperLoading ? "#9CA3AF" : "white", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, cursor: aiHelperLoading ? "not-allowed":"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:7 }}>
                  {aiHelperLoading ? <><span style={{ width:13,height:13,border:"2px solid rgba(255,255,255,0.3)",borderTopColor:"white",borderRadius:"50%",display:"inline-block",animation:"spin 0.8s linear infinite" }} />Thinking…</> : "✨ Get Ideas"}
                </button>
                {aiHelperResult && (
                  <div style={{ marginTop:10, background:"#F9FAFB", border:"1px solid #E5E7EB", borderRadius:7, padding:"10px 12px" }}>
                    <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12.5, color:"#111827", margin:"0 0 8px", lineHeight:1.6, whiteSpace:"pre-wrap" }}>{aiHelperResult}</p>
                    <button onClick={applyAiHelper}
                      style={{ padding:"5px 12px", borderRadius:6, border:"none", background:"#059669", color:"white", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer" }}>
                      ✓ Use This
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes / Additional Context */}
          <div style={{ marginBottom:14 }}>
            <label style={lbl}>Additional Notes / Context <span style={{ textTransform:"none", fontWeight:500, letterSpacing:0, color:"#9CA3AF" }}>(optional)</span></label>
            <textarea value={form.notes} onChange={e => setF("notes", e.target.value)} spellCheck
              placeholder="Any special context, IEP goals to address, class size, prior knowledge, or specific requirements…"
              style={{ ...inp, minHeight:70, resize:"vertical", lineHeight:1.6, background:"#FAFAFA" }} />
          </div>

          {error && <div style={{ background:"#FEF2F2", border:"1px solid #FCA5A5", borderRadius:7, padding:"10px 14px", color:"#DC2626", fontSize:13, marginBottom:12 }}>{error}</div>}

          <button onClick={generate} disabled={loading || !form.subject.trim() || !form.topic.trim()}
            style={{ width:"100%", padding:"13px", borderRadius:8, border:"none", background: !form.subject.trim()||!form.topic.trim()||loading ? "#E5E7EB" : BRAND, color: !form.subject.trim()||!form.topic.trim()||loading ? "#9CA3AF" : "white", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:14, cursor: !form.subject.trim()||!form.topic.trim()||loading ? "not-allowed" : "pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:8, letterSpacing:0.3, boxShadow: !form.subject.trim()||!form.topic.trim()||loading ? "none" : `0 3px 12px ${BRAND}44` }}>
            {loading
              ? <><span style={{ width:16, height:16, border:"2px solid rgba(255,255,255,0.3)", borderTopColor:"white", borderRadius:"50%", display:"inline-block", animation:"spin 0.8s linear infinite" }} />Building lesson plan…</>
              : "✦  Generate Lesson Plan"}
          </button>
        </div>
      </div>

      {/* RIGHT: Result */}
      <div style={{ background:"white", borderRadius:10, border:"1px solid #E5E7EB", overflow:"hidden" }}>
        <div style={{ background:BRAND, padding:"12px 18px", display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
          <span style={{ fontFamily:"'Playfair Display',serif", color:"white", fontSize:15, fontWeight:700 }}>📄  Lesson Plan</span>
          {result && (
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              <button onClick={copyPlan}
                style={{ padding:"6px 12px", borderRadius:6, border:`1.5px solid ${copied ? "#86EFAC" : "rgba(255,255,255,0.4)"}`, background: copied ? "#D1FAE5" : "transparent", color: copied ? "#166534" : "white", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer", transition:"all 0.2s", display:"flex", alignItems:"center", gap:5 }}>
                {copied ? "✓ Copied!" : "📋 Copy Text"}
              </button>
              <button onClick={printPlan}
                style={{ padding:"6px 12px", borderRadius:6, border:"none", background:"white", color:BRAND, fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                🖨️ Print / PDF
              </button>
              <button onClick={exportToGoogleDocs}
                style={{ padding:"6px 12px", borderRadius:6, border:"1.5px solid rgba(255,255,255,0.4)", background:"transparent", color:"white", fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6" fill="none" stroke="white" strokeWidth="2"/><line x1="8" y1="13" x2="16" y2="13" stroke="white" strokeWidth="2"/><line x1="8" y1="17" x2="16" y2="17" stroke="white" strokeWidth="2"/></svg>
                Export for Google Docs
              </button>
            </div>
          )}
        </div>

        {/* Fallback copy text box */}
        {showCopyBox && (
          <div style={{ padding:"12px 18px", background:"#F0FDF4", borderBottom:"1px solid #86EFAC" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:6 }}>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:"#166534" }}>Select all text below and copy (Ctrl+A then Ctrl+C):</span>
              <button onClick={()=>setShowCopyBox(false)} style={{ border:"none", background:"none", cursor:"pointer", color:"#6B7280", fontSize:16 }}>✕</button>
            </div>
            <textarea readOnly value={buildPlanText()} onClick={e=>e.target.select()}
              style={{ width:"100%", height:160, fontFamily:"monospace", fontSize:11, padding:8, border:"1px solid #86EFAC", borderRadius:6, resize:"vertical", background:"white" }} />
          </div>
        )}

        {/* Google Docs export box */}
        {showGdocsBox && (
          <div style={{ padding:"12px 18px", background:"#EFF6FF", borderBottom:"1px solid #BAE6FD" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <span style={{ fontFamily:"'Inter',sans-serif", fontSize:12, fontWeight:700, color:"#1E40AF" }}>Export to Google Docs — 2 steps:</span>
              <button onClick={()=>setShowGdocsBox(false)} style={{ border:"none", background:"none", cursor:"pointer", color:"#6B7280", fontSize:16 }}>✕</button>
            </div>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"#1E40AF", margin:"0 0 8px", lineHeight:1.6 }}>
              <strong>Step 1:</strong> Select all text below (Ctrl+A / Cmd+A) and copy it.<br/>
              <strong>Step 2:</strong> Go to <a href="https://docs.new" target="_blank" rel="noopener noreferrer" style={{ color:"#1D4ED8", fontWeight:700 }}>docs.new</a> → paste (Ctrl+V / Cmd+V) into the blank document.
            </p>
            <textarea readOnly value={buildPlanText()} onClick={e=>e.target.select()}
              style={{ width:"100%", height:160, fontFamily:"monospace", fontSize:11, padding:8, border:"1px solid #BAE6FD", borderRadius:6, resize:"vertical", background:"white" }} />
          </div>
        )}

        {loading ? (
          <div style={{ padding:"80px 40px", display:"flex", flexDirection:"column", alignItems:"center", gap:16 }}>
            <div style={{ width:40, height:40, border:`3px solid #E5E7EB`, borderTopColor:BRAND, borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#6B7280", fontStyle:"italic" }}>Building your lesson plan…</p>
          </div>
        ) : result ? (
          <div style={{ padding:"24px 28px" }}>
            {/* Header */}
            <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:20, color:BRAND, margin:"0 0 4px" }}>{result.title}</h2>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#6B7280", margin:"0 0 16px" }}>{result.gradeSubject} &nbsp;|&nbsp; {result.duration}</p>
            <div style={{ background:LIGHT, borderLeft:`4px solid ${BRAND}`, borderRadius:"0 7px 7px 0", padding:"9px 14px", marginBottom:20, fontSize:12, color:"#374151", lineHeight:1.5 }}>
              <strong style={{ color:BRAND }}>Standard:</strong> {result.standard}
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginBottom:20 }}>
              {/* Objectives */}
              <div>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#6B7280", margin:"0 0 8px" }}>Objectives</p>
                <ul style={{ margin:0, paddingLeft:16 }}>
                  {(result.objectives||[]).map((o,i) => <li key={i} style={{ fontFamily:"'Inter',sans-serif", fontSize:12.5, color:"#1F2937", lineHeight:1.5, marginBottom:5 }}>{o}</li>)}
                </ul>
              </div>
              {/* Materials */}
              <div>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#6B7280", margin:"0 0 8px" }}>Materials</p>
                <ul style={{ margin:0, paddingLeft:16 }}>
                  {(result.materials||[]).map((m,i) => <li key={i} style={{ fontFamily:"'Inter',sans-serif", fontSize:12.5, color:"#1F2937", lineHeight:1.5, marginBottom:5 }}>{m}</li>)}
                </ul>
              </div>
              {/* Vocabulary */}
              <div>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#6B7280", margin:"0 0 8px" }}>Key Vocabulary</p>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {(result.vocabulary||[]).map((v,i) => <span key={i} style={{ background:LIGHT, color:BRAND, border:`1px solid ${BRAND}30`, borderRadius:20, padding:"2px 10px", fontSize:12, fontFamily:"'Inter',sans-serif", fontWeight:600 }}>{v}</span>)}
                </div>
              </div>
            </div>

            {/* Lesson Sequence */}
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#6B7280", margin:"0 0 10px", borderBottom:"1px solid #E5E7EB", paddingBottom:8 }}>Lesson Sequence</p>
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:20 }}>
              {(result.sections||[]).map((sec,i) => {
                const sectionColors = ["#1E3A5F","#CF27F5","#0369A1","#B45309","#374151","#166534"];
                const bgColor = sectionColors[i] || "#374151";
                return (
                  <div key={i} style={{ border:"1px solid #E5E7EB", borderRadius:8, overflow:"hidden" }}>
                    <div style={{ background:bgColor, padding:"7px 14px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:700, fontSize:13, color:"white" }}>{sec.name}</span>
                      <span style={{ fontFamily:"'Inter',sans-serif", fontSize:11, color:"rgba(255,255,255,0.75)", fontWeight:600 }}>{sec.duration}</span>
                    </div>
                    <div style={{ padding:"10px 14px" }}>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#374151", margin:"0 0 7px", lineHeight:1.55 }}>{sec.description}</p>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"#6B7280", margin:"0 0 4px" }}><strong style={{ color:"#374151" }}>Teacher:</strong> {sec.teacherMoves}</p>
                      <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12, color:"#6B7280", margin: sec.udlNotes ? "0 0 4px" : 0 }}><strong style={{ color:"#374151" }}>Students:</strong> {sec.studentActions}</p>
                      {sec.udlNotes && <p style={{ fontFamily:"'Inter',sans-serif", fontSize:11.5, color:"#0369A1", margin:0, background:"#F0F9FF", borderRadius:5, padding:"4px 8px", marginTop:5 }}>🖼️ <strong>UDL/Visual:</strong> {sec.udlNotes}</p>}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Assessment */}
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#6B7280", margin:"0 0 10px", borderBottom:"1px solid #E5E7EB", paddingBottom:8 }}>Assessment</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:20 }}>
              {[["Formative","🔍",result.assessment?.formative],["Exit Ticket","✏️",result.assessment?.exitTicket],["Summative","📝",result.assessment?.summative]].map(([ttl,ico,val]) => (
                <div key={ttl} style={{ background:"#F9FAFB", borderRadius:8, padding:"10px 12px", border:"1px solid #E5E7EB" }}>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.7, color:BRAND, margin:"0 0 5px" }}>{ico} {ttl}</p>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12.5, color:"#374151", margin:0, lineHeight:1.5 }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Differentiation */}
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.8, color:"#6B7280", margin:"0 0 10px", borderBottom:"1px solid #E5E7EB", paddingBottom:8 }}>Differentiation</p>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:20 }}>
              {[["ELL","🌐",result.differentiation?.ell],["IEP","♿",result.differentiation?.iep],["Gifted","⭐",result.differentiation?.gifted],["Universal Design","🔑",result.differentiation?.universal]].map(([ttl,ico,val]) => (
                <div key={ttl} style={{ background:"#F9FAFB", borderRadius:8, padding:"10px 12px", border:"1px solid #E5E7EB" }}>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.7, color:BRAND, margin:"0 0 5px" }}>{ico} {ttl}</p>
                  <p style={{ fontFamily:"'Inter',sans-serif", fontSize:12.5, color:"#374151", margin:0, lineHeight:1.5 }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Homework & Notes */}
            {result.homework && (
              <div style={{ background:"#F0F9FF", border:"1px solid #BAE6FD", borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.7, color:"#0369A1", margin:"0 0 5px" }}>📚 Homework / Extension</p>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#1F2937", margin:0, lineHeight:1.55 }}>{result.homework}</p>
              </div>
            )}
            {result.teacherNotes && (
              <div style={{ background:"#FEFCE8", border:"1px solid #FDE68A", borderRadius:8, padding:"12px 14px" }}>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:0.7, color:"#B45309", margin:"0 0 5px" }}>💡 Teacher Notes</p>
                <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#1F2937", margin:0, lineHeight:1.55 }}>{result.teacherNotes}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ padding:"80px 40px", display:"flex", flexDirection:"column", alignItems:"center", gap:14, textAlign:"center" }}>
            <div style={{ width:60, height:60, borderRadius:14, background:"#F3F4F6", display:"flex", alignItems:"center", justifyContent:"center", fontSize:28 }}>📋</div>
            <p style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"#9CA3AF", fontWeight:600, margin:0 }}>Your lesson plan will appear here</p>
            <p style={{ fontFamily:"'Inter',sans-serif", fontSize:13, color:"#D1D5DB", lineHeight:1.7, margin:0 }}>Fill in the details on the left and click<br /><strong style={{ color:"#9CA3AF" }}>Generate Lesson Plan</strong> to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SITE SHELL — The Tech Savvy Teacher
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const TOOLS = [
  { id:"lesson",    label:"Lesson Plan Generator", icon:"📋", desc:"Generate complete, differentiated lesson plans instantly" },
  { id:"worksheet", label:"Worksheet Builder",     icon:"📄", desc:"Build print-ready worksheets aligned to NY Standards" },
  { id:"email",     label:"Professional Email",    icon:"✉️",  desc:"Transform rough notes into polished professional emails" },
];

const SITE_COLOR = "#CF27F5";
const SITE_DARK  = "#8B0AB0";

function TheTechSavvyTeacherAppRoot() {
  const [activeTool, setActiveTool] = useState("lesson");

  return (
    <div style={{ display:"flex", flexDirection:"column", minHeight:"100vh", background:"#F8F9FA", fontFamily:"'Inter','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Playfair+Display:wght@600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; }
        @keyframes spin  { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        @keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-9px)} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        :focus-visible { outline: 3px solid #CF27F5 !important; outline-offset: 2px !important; border-radius: 4px; }
        @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation-duration:0.01ms !important; transition-duration:0.01ms !important; } }
        @media print { .site-header { display:none !important; } }
        .skip-nav { position:absolute; top:-100px; left:8px; z-index:9999; background:#CF27F5; color:white; padding:8px 16px; border-radius:6px; font-family:'Inter',sans-serif; font-weight:700; font-size:14px; text-decoration:none; transition:top 0.2s; }
        .skip-nav:focus { top:8px; }
        .worksheet-paper { background:white; }
        .canvas-area { background:#F1F3F5; }
        .ws-element:hover .el-delete-btn { opacity: 1 !important; }
        .el-delete-btn { opacity: 0; transition: opacity 0.15s; }
        .app-shell { background:#F8F9FA; }
        .tool-tab { transition: background 0.15s, border-color 0.15s !important; }
        .tool-tab:hover { background: rgba(255,255,255,0.15) !important; }
      `}</style>

      <a href="#main-content" className="skip-nav">Skip to main content</a>

      {/* ━━ SITE HEADER ━━ */}
      <header className="site-header" style={{
        background: `linear-gradient(160deg, ${SITE_DARK} 0%, ${SITE_COLOR} 60%, #E05BFF 100%)`,
        flexShrink: 0,
        boxShadow: "0 3px 18px rgba(207,39,245,0.45)",
        position: "relative",
      }}>

        {/* Powered-by badge — top right */}
        <div style={{ position:"absolute", top:14, right:20, display:"flex", alignItems:"center", gap:7, background:"rgba(255,255,255,0.14)", borderRadius:20, padding:"5px 14px 5px 10px", backdropFilter:"blur(6px)", zIndex:2 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background:"#4ADE80", boxShadow:"0 0 0 2px rgba(74,222,128,0.35)" }} />
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.9)", fontWeight:600, fontFamily:"'Inter',sans-serif", letterSpacing:0.3 }}>Powered by Lovable AI</span>
        </div>

        {/* Centered branding */}
        <div style={{ textAlign:"center", padding:"24px 32px 0", display:"flex", flexDirection:"column", alignItems:"center" }}>
          <div style={{ fontSize:38, lineHeight:1, marginBottom:10 }} aria-hidden="true">💽</div>
          <h1 style={{ fontFamily:"'Playfair Display',serif", color:"white", fontSize:30, fontWeight:800, margin:"0 0 7px", letterSpacing:0.3, lineHeight:1.1 }}>
            The Tech Savvy Teacher
          </h1>
          <p style={{ fontFamily:"'Inter',sans-serif", fontSize:10.5, fontWeight:700, color:"rgba(255,255,255,0.78)", letterSpacing:3, textTransform:"uppercase", margin:"0 0 0" }}>
            AI TOOLS FOR EDUCATORS
          </p>
        </div>

        {/* Nav tabs — centered row below title */}
        <nav role="navigation" aria-label="Tool navigation"
          style={{ display:"flex", justifyContent:"center", gap:2, marginTop:16, background:"rgba(0,0,0,0.18)" }}>
          {TOOLS.map(t => {
            const isActive = activeTool === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTool(t.id)}
                className="tool-tab"
                role="tab" aria-selected={isActive} aria-label={t.label}
                style={{
                  display:"flex", alignItems:"center", gap:8,
                  padding:"13px 28px",
                  border:"none",
                  borderBottom: isActive ? "3px solid white" : "3px solid transparent",
                  background: isActive ? "rgba(255,255,255,0.2)" : "transparent",
                  color:"white",
                  fontFamily:"'Inter',sans-serif",
                  fontWeight: isActive ? 700 : 500,
                  fontSize:14,
                  cursor:"pointer",
                  whiteSpace:"nowrap",
                  letterSpacing:0.1,
                }}>
                <span style={{ fontSize:17 }} aria-hidden="true">{t.icon}</span>
                {t.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* ━━ MAIN CONTENT ━━ */}
      <main id="main-content" role="main"
        style={{ flex:1, overflow: activeTool==="worksheet" ? "hidden" : "auto", display:"flex", flexDirection:"column" }}>
        {activeTool === "worksheet" && (
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", height:"calc(100vh - 172px)" }}>
            <WorksheetBuilder />
          </div>
        )}
        {activeTool === "lesson" && <LessonPlanGenerator />}
        {activeTool === "email"   && <EmailAssistant />}
      </main>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// EXPORT — wrapped to play nicely with TanStack Start route component
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function TheTechSavvyTeacherApp() {
  return <TheTechSavvyTeacherAppRoot />;
}
