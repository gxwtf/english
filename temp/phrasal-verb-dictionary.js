"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.convertToDictionaryResult = exports.getPhrasesByParticle = exports.getPhrasesByVerb = exports.queryByComponents = exports.PHRASAL_VERB_DICTIONARY = void 0;
exports.queryPhrasalVerb = queryPhrasalVerb;
exports.getRelatedPhrasalVerbs = getRelatedPhrasalVerbs;
exports.getPhrasalVerbsWithParticle = getPhrasalVerbsWithParticle;
exports.getPhrasalVerbStats = getPhrasalVerbStats;
// 短语动词词库 - 基于常见词典
const PHRASAL_VERB_DICTIONARY = [
    // turn off/on 系列
    {
        phrase: "turn on",
        type: "verb",
        meaning: "to activate or start a device or machine; to excite someone; to begin",
        examples: [
            "Turn on the light, please.",
            "The loud music turned me on.",
            "She turned on the charm."
        ]
    },
    {
        phrase: "turn off",
        type: "verb",
        meaning: "to deactivate or stop a device; to discourage someone; to dismiss someone",
        examples: [
            "Please turn off the TV when you leave.",
            "His rude comments turned me off.",
            "The manager turned off three employees."
        ]
    },
    {
        phrase: "turn up",
        type: "verb",
        meaning: "to appear; to increase the volume; to discover; to happen",
        examples: [
            "She promised to come but didn't turn up.",
            "Could you turn up the volume?",
            "The police turned up nothing suspicious."
        ]
    },
    {
        phrase: "turn down",
        type: "verb",
        meaning: "to decrease the volume; to reject; to reduce something",
        examples: [
            "Please turn down the music.",
            "He turned down the job offer.",
            "The thermostat is turned down too low."
        ]
    },
    // put on/off 系列
    {
        phrase: "put on",
        type: "verb",
        meaning: "to wear clothes; to add weight; to pretend",
        examples: [
            "Put on your coat, it's cold outside.",
            "He put on three kilograms.",
            "She put on an accent."
        ]
    },
    {
        phrase: "put off",
        type: "verb",
        meaning: "to postpone; to disgust someone; to turn off a device",
        examples: [
            "Don't put off until tomorrow what you can do today.",
            "His behavior put me off.",
            "Put off the light when you leave."
        ]
    },
    {
        phrase: "put up with",
        type: "verb",
        meaning: "to tolerate or endure something unpleasant",
        examples: [
            "I won't put up with his behavior anymore.",
            "She puts up with a lot from her boss."
        ]
    },
    // look up 系列
    {
        phrase: "look up",
        type: "verb",
        meaning: "to search for information; to improve; to visit someone",
        examples: [
            "Look up the word in the dictionary.",
            "Business is looking up.",
            "I'll look you up when I'm in town."
        ]
    },
    {
        phrase: "look after",
        type: "verb",
        meaning: "to take care of someone or something",
        examples: [
            "Could you look after my cat while I'm away?",
            "She looks after her elderly parents."
        ]
    },
    {
        phrase: "look forward to",
        type: "verb",
        meaning: "to anticipate or expect something with pleasure",
        examples: [
            "I'm looking forward to the holiday.",
            "We look forward to seeing you soon."
        ]
    },
    // get up 系列
    {
        phrase: "get up",
        type: "verb",
        meaning: "to rise from bed; to organize; to increase",
        examples: [
            "I get up at 6 AM every day.",
            "We need to get up a team.",
            "The wind got up during the night."
        ]
    },
    {
        phrase: "get over",
        type: "verb",
        meaning: "to recover from illness or shock; to overcome something",
        examples: [
            "It took him a week to get over the flu.",
            "She finally got over her fear of heights."
        ]
    },
    {
        phrase: "get along with",
        type: "verb",
        meaning: "to have a good relationship with someone; to make progress",
        examples: [
            "Do you get along with your colleagues?",
            "How are you getting along with your new project?"
        ]
    },
    // take off 系列
    {
        phrase: "take off",
        type: "verb",
        meaning: "to remove clothes; to depart by air; to become successful",
        examples: [
            "Take off your shoes before entering.",
            "The plane will take off in ten minutes.",
            "Her career really took off after that movie."
        ]
    },
    {
        phrase: "take out",
        type: "verb",
        meaning: "to remove; to escort someone out; to eliminate",
        examples: [
            "Take out the trash.",
            "He took her out for dinner.",
            "The dentist took out two teeth."
        ]
    },
    // give up 系列
    {
        phrase: "give up",
        type: "verb",
        meaning: "to stop trying; to surrender",
        examples: [
            "Never give up on your dreams.",
            "The soldiers gave up after three days.",
            "I'm trying to give up smoking."
        ]
    },
    {
        phrase: "give in",
        type: "verb",
        meaning: "to yield or surrender; to submit",
        examples: [
            "Don't give in to pressure.",
            "After much discussion, she gave in."
        ]
    },
    // come across 系列
    {
        phrase: "come across",
        type: "verb",
        meaning: "to meet someone by chance; to appear to be a certain way",
        examples: [
            "I came across an old friend yesterday.",
            "He comes across as very confident."
        ]
    },
    {
        phrase: "come up with",
        type: "verb",
        meaning: "to produce an idea; to suggest something",
        examples: [
            "She came up with a great idea.",
            "Can you come up with a solution?"
        ]
    },
    // run into 系列
    {
        phrase: "run into",
        type: "verb",
        meaning: "to meet someone unexpectedly; to encounter problems; to collide",
        examples: [
            "I ran into my teacher at the mall.",
            "We ran into some unexpected problems.",
            "The car ran into a tree."
        ]
    },
    // break down 系列
    {
        phrase: "break down",
        type: "verb",
        meaning: "(machines) to stop functioning; to emotionally collapse; for negotiations to fail",
        examples: [
            "My car broke down on the highway.",
            "She broke down and started crying.",
            "The peace talks broke down."
        ]
    }
];
exports.PHRASAL_VERB_DICTIONARY = PHRASAL_VERB_DICTIONARY;
// 查询短语词库
function queryPhrasalVerb(query) {
    const normalized = query.toLowerCase().trim();
    return PHRASAL_VERB_DICTIONARY.find(entry => entry.phrase.toLowerCase() === normalized) || null;
}
// 获取相关短语建议
function getRelatedPhrasalVerbs(baseVerb) {
    return PHRASAL_VERB_DICTIONARY.filter(entry => entry.phrase.toLowerCase().startsWith(baseVerb.toLowerCase() + ' '));
}
// 获取所有以某个介词开头的短语
function getPhrasalVerbsWithParticle(particle) {
    const normalizedParticle = particle.toLowerCase();
    return PHRASAL_VERB_DICTIONARY.filter(entry => entry.phrase.toLowerCase().includes(' ' + normalizedParticle));
}
// 短语动词统计
function getPhrasalVerbStats() {
    const baseVerbs = new Set();
    const particles = new Set();
    PHRASAL_VERB_DICTIONARY.forEach(entry => {
        const [verb, ...parts] = entry.phrase.split(' ');
        baseVerbs.add(verb);
        particles.add(parts.join(' '));
    });
    return {
        total: PHRASAL_VERB_DICTIONARY.length,
        uniqueBaseVerbs: baseVerbs.size,
        uniqueParticles: particles.size,
        baseVerbs: Array.from(baseVerbs).sort(),
        particles: Array.from(particles).sort()
    };
}
