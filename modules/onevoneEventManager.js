const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const eventsByChannel = new Map();

// Handled by interactions/join_1v1_event.js — the file name must match this id.
const JOIN_BUTTON_ID = 'join_1v1_event';

const JOIN_BUTTON_LABELS = {
    signup: 'Join this 1v1 event',
    alsoJoin: 'I also wanna join'
};

const EVENT_FORMATS = {
    SINGLE: 'single',
    DOUBLE: 'double'
};

const FORMAT_LABELS = {
    [EVENT_FORMATS.SINGLE]: 'single elimination',
    [EVENT_FORMATS.DOUBLE]: 'double elimination'
};

const BRACKET_LABELS = {
    winners: 'Winners bracket',
    losers: 'Losers bracket',
    losersFinal: 'Losers final',
    final: 'Grand final'
};

const BRACKET_ORDER = ['winners', 'losers', 'losersFinal', 'final'];

function formatLabel(format) {
    return FORMAT_LABELS[format] || FORMAT_LABELS[EVENT_FORMATS.SINGLE];
}

function seedingLabel(seeded) {
    return seeded ? 'SABR 1v1 seeded' : 'random draw';
}

function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

function highestPowerOfTwoLessThan(n) {
    if (n <= 1) return 0;
    return 2 ** Math.floor(Math.log2(n - 1));
}

// Best player first; anyone missing from the leaderboard is unranked and seeded last.
// The pre-shuffle keeps unranked players (and any shared rank) in random order, since
// Array#sort is stable.
function sortBySeed(players, ranks) {
    const rankFor = id => {
        const rank = ranks ? ranks.get(id) : undefined;
        return typeof rank === 'number' ? rank : Number.POSITIVE_INFINITY;
    };

    return shuffle(players).sort((a, b) => rankFor(a) - rankFor(b));
}

// Pairs a seed-ordered list strongest against weakest: 1 vs last, 2 vs second last, ...
function pairBySeed(seededPlayers, roundNumber, bracket) {
    const matches = [];

    for (let i = 0; i < seededPlayers.length / 2; i++) {
        const match = {
            id: `${roundNumber}-${i + 1}`,
            players: [seededPlayers[i], seededPlayers[seededPlayers.length - 1 - i]],
            winnerId: null
        };

        if (bracket) match.bracket = bracket;
        matches.push(match);
    }

    return matches;
}

// Same bye/match counts as buildRound, but byes go to the best seeds instead of at random.
function buildSeededRound(players, ranks, roundNumber) {
    const seeded = sortBySeed(players, ranks);
    const targetWinners = highestPowerOfTwoLessThan(seeded.length);
    const byeCount = Math.max(0, (targetWinners * 2) - seeded.length);

    return {
        number: roundNumber,
        byes: seeded.slice(0, byeCount),
        matches: pairBySeed(seeded.slice(byeCount), roundNumber, null)
    };
}

function buildSeededDoubleRound(players, ranks, roundNumber) {
    const seeded = sortBySeed(players, ranks);
    const byes = seeded.length % 2 === 1 ? [seeded.shift()] : [];

    return {
        number: roundNumber,
        byes,
        waiting: [],
        matches: pairBySeed(seeded, roundNumber, 'winners')
    };
}

function buildRound(players, roundNumber) {
    const randomized = shuffle(players);
    const targetWinners = highestPowerOfTwoLessThan(randomized.length);
    const matchCount = randomized.length - targetWinners;
    const byeCount = Math.max(0, (targetWinners * 2) - randomized.length);

    const byes = randomized.slice(0, byeCount);
    const matchPlayers = randomized.slice(byeCount);
    const matches = [];

    for (let i = 0; i < matchCount; i++) {
        const idx = i * 2;
        matches.push({
            id: `${roundNumber}-${i + 1}`,
            players: [matchPlayers[idx], matchPlayers[idx + 1]],
            winnerId: null
        });
    }

    return {
        number: roundNumber,
        byes,
        matches
    };
}

// A real losers bracket alternates between two kinds of round: one where the players
// already in it play each other, and one where the survivors of that meet the players
// who just dropped out of the winners bracket. Pairing everyone on one loss every round
// instead produces odd pools and arbitrary byes - with 2 left in the winners bracket and
// 4 in the losers bracket you would get 2 losers winners plus 1 winners-bracket dropout
// fighting over 3 slots. `dropRounds` (playerId -> the round their first loss happened in)
// is what separates the two groups.
function splitLosersBracket(oneLoss, dropRounds, roundNumber) {
    const justDropped = id => dropRounds.get(id) === roundNumber - 1;
    const dropIns = oneLoss.filter(justDropped);
    const veterans = oneLoss.filter(id => !justDropped(id));

    // Nobody has played a losers round yet, so the drop-ins open the bracket against
    // each other.
    if (veterans.length === 0) {
        return { playing: dropIns, waiting: [] };
    }

    // More veterans than there are drop-ins to pair them with: the veterans play a
    // consolidation round first and the drop-ins wait one round for the losers final.
    if (veterans.length > dropIns.length) {
        return { playing: veterans, waiting: dropIns };
    }

    // Veterans meet the drop-ins. Interleaving keeps the pairs veteran vs drop-in, so
    // any surplus drop-ins are the ones left to play each other.
    const playing = [];
    for (let i = 0; i < veterans.length; i++) {
        playing.push(veterans[i], dropIns[i]);
    }
    playing.push(...dropIns.slice(veterans.length));

    return { playing, waiting: [] };
}

// Double elimination is tracked by loss count instead of a fixed bracket tree:
// 0 losses = winners bracket, 1 loss = losers bracket, 2 losses = eliminated.
function buildDoubleRound(alive, losses, roundNumber, dropRounds = new Map()) {
    const lossesFor = id => losses.get(id) || 0;
    const undefeated = shuffle(alive.filter(id => lossesFor(id) === 0));
    const oneLoss = shuffle(alive.filter(id => lossesFor(id) === 1));

    const matches = [];
    const byes = [];
    const waiting = [];
    let finalistId = null;

    if (undefeated.length === 1 && oneLoss.length === 1) {
        matches.push({
            id: `${roundNumber}-1`,
            bracket: 'final',
            players: [undefeated[0], oneLoss[0]],
            winnerId: null
        });

        return { number: roundNumber, byes, waiting, finalistId, matches };
    }

    const addMatches = (group, bracket) => {
        const pool = [...group];
        if (pool.length % 2 === 1) {
            byes.push(pool.pop());
        }

        for (let i = 0; i < pool.length; i += 2) {
            matches.push({
                id: `${roundNumber}-${matches.length + 1}`,
                bracket,
                players: [pool[i], pool[i + 1]],
                winnerId: null
            });
        }
    };

    // The last player standing in the winners bracket has nobody left to play and sits
    // out until the grand final.
    if (undefeated.length === 1) {
        finalistId = undefeated[0];
    } else {
        addMatches(undefeated, 'winners');
    }

    const losersRound = splitLosersBracket(oneLoss, dropRounds, roundNumber);
    // The winners-bracket finalist is waiting and these two are the only players left on
    // one loss, so this match decides who joins them in the grand final.
    const isLosersFinal = !!finalistId && oneLoss.length === 2 && losersRound.playing.length === 2;

    addMatches(losersRound.playing, isLosersFinal ? 'losersFinal' : 'losers');
    waiting.push(...losersRound.waiting);

    return { number: roundNumber, byes, waiting, finalistId, matches };
}

// Losses are derived from recorded results rather than counted incrementally, so a
// corrected result in an earlier round automatically produces the right standings.
// `dropRounds` records the round each player picked up their first loss in, which is
// what the losers bracket needs to tell drop-ins from players already in it.
function computeStandings(event) {
    const losses = new Map();
    const dropRounds = new Map();

    for (const id of event.signups) {
        losses.set(id, 0);
    }

    for (const round of event.rounds) {
        for (const match of round.matches) {
            if (!match.winnerId) continue;
            const loser = match.players.find(playerId => playerId !== match.winnerId);
            if (!loser) continue;

            const total = (losses.get(loser) || 0) + 1;
            losses.set(loser, total);
            if (total === 1) dropRounds.set(loser, round.number);
        }
    }

    return { losses, dropRounds };
}

function getAlivePlayers(event) {
    const { losses, dropRounds } = computeStandings(event);
    const alive = [...event.signups].filter(id => (losses.get(id) || 0) < 2);
    return { alive, losses, dropRounds };
}

function getRoundParticipants(round) {
    const participants = [];
    participants.push(...round.byes);
    for (const match of round.matches) {
        participants.push(match.players[0], match.players[1]);
    }
    return participants;
}

function getRoundAdvancers(round) {
    const advancers = [...round.byes];
    for (const match of round.matches) {
        if (match.winnerId) {
            advancers.push(match.winnerId);
        }
    }
    return advancers;
}

function isRoundComplete(round) {
    return round.matches.every(match => !!match.winnerId);
}

function formatRoundLineup(round) {
    const lines = [`Round ${round.number} lineup:`];

    if (round.matches.length === 0) {
        lines.push('No matches this round.');
    } else if (round.matches.some(match => !!match.bracket)) {
        let matchNumber = 1;
        for (const bracket of BRACKET_ORDER) {
            const group = round.matches.filter(match => match.bracket === bracket);
            if (group.length === 0) continue;

            lines.push(`**${BRACKET_LABELS[bracket]}**`);
            for (const match of group) {
                lines.push(`Match ${matchNumber}: <@${match.players[0]}> vs <@${match.players[1]}>`);
                matchNumber++;
            }
        }
    } else {
        for (let i = 0; i < round.matches.length; i++) {
            const match = round.matches[i];
            lines.push(`Match ${i + 1}: <@${match.players[0]}> vs <@${match.players[1]}>`);
        }
    }

    if (round.byes.length > 0) {
        lines.push(`Auto-advanced: ${round.byes.map(id => `<@${id}>`).join(', ')}`);
    }

    const waiting = round.waiting || [];
    if (waiting.length > 0) {
        lines.push(`Waiting for the losers bracket to catch up: ${waiting.map(id => `<@${id}>`).join(', ')}`);
    }

    if (round.finalistId) {
        lines.push(`Waiting in the grand final: <@${round.finalistId}>`);
    }

    return lines.join('\n');
}

function createEvent(channelId, hostId, eventName, format = EVENT_FORMATS.SINGLE, seeded = false) {
    if (eventsByChannel.has(channelId)) {
        return { ok: false, reason: 'event_exists' };
    }

    if (format !== EVENT_FORMATS.SINGLE && format !== EVENT_FORMATS.DOUBLE) {
        return { ok: false, reason: 'invalid_format' };
    }

    const event = {
        channelId,
        hostId,
        eventName,
        format,
        seeded: !!seeded,
        status: 'signup',
        signups: new Set(),
        rounds: [],
        currentRoundIndex: -1,
        championId: null
    };

    eventsByChannel.set(channelId, event);
    return { ok: true, event };
}

function getEvent(channelId) {
    return eventsByChannel.get(channelId) || null;
}

function finishEvent(channelId) {
    return eventsByChannel.delete(channelId);
}

function joinEvent(channelId, userId) {
    const event = getEvent(channelId);
    if (!event) return { ok: false, reason: 'event_not_found' };
    if (event.status !== 'signup') return { ok: false, reason: 'signup_closed' };
    if (event.signups.has(userId)) return { ok: false, reason: 'already_joined' };

    event.signups.add(userId);
    return { ok: true, count: event.signups.size };
}

function buildJoinRow(label) {
    const joinButton = new ButtonBuilder()
        .setCustomId(JOIN_BUTTON_ID)
        .setLabel(label)
        .setStyle(ButtonStyle.Success);

    return new ActionRowBuilder().addComponents(joinButton);
}

// Shared by /join and the join button so both paths behave identically. Every join
// announcement carries the button again, so the newest message is always clickable.
async function respondToJoinRequest(interaction) {
    const channelId = interaction.channelId;
    const userId = interaction.user.id;
    const event = getEvent(channelId);

    if (!event) {
        await interaction.reply({ content: 'There is no active 1v1 event in this channel/thread.', flags: 64 });
        return;
    }

    const result = joinEvent(channelId, userId);
    if (!result.ok) {
        if (result.reason === 'signup_closed') {
            await interaction.reply({ content: 'Signups are closed for this event.', flags: 64 });
            return;
        }

        if (result.reason === 'already_joined') {
            await interaction.reply({ content: 'You are already signed up for this event.', flags: 64 });
            return;
        }

        await interaction.reply({ content: 'Could not join this 1v1 event.', flags: 64 });
        return;
    }

    await interaction.reply({
        content: `You joined **${event.eventName}**. Total signed up: ${result.count}.`,
        flags: 64
    });

    await interaction.channel.send({
        content: `<@${userId}> joined the 1v1 event. (${result.count} signed up)`,
        components: [buildJoinRow(JOIN_BUTTON_LABELS.alsoJoin)]
    });
}

// `ranks` (playerId -> ladder rank) is required for a seeded event and ignored otherwise.
// Only round 1 uses it; later rounds are drawn from the survivors as usual.
function startEvent(channelId, userId, ranks = null) {
    const event = getEvent(channelId);
    if (!event) return { ok: false, reason: 'event_not_found' };
    if (event.hostId !== userId) return { ok: false, reason: 'not_host' };
    if (event.status !== 'signup') return { ok: false, reason: 'already_started' };
    if (event.signups.size < 2) return { ok: false, reason: 'not_enough_players' };
    if (event.seeded && !ranks) return { ok: false, reason: 'ranks_missing' };

    const players = [...event.signups];
    const isDouble = event.format === EVENT_FORMATS.DOUBLE;

    let firstRound;
    if (event.seeded) {
        firstRound = isDouble
            ? buildSeededDoubleRound(players, ranks, 1)
            : buildSeededRound(players, ranks, 1);
    } else {
        firstRound = isDouble
            ? buildDoubleRound(players, new Map(), 1)
            : buildRound(players, 1);
    }

    event.status = 'active';
    event.rounds.push(firstRound);
    event.currentRoundIndex = 0;

    const rankedCount = event.seeded ? players.filter(id => ranks.has(id)).length : 0;

    return {
        ok: true,
        round: firstRound,
        seeded: event.seeded,
        rankedCount,
        unrankedCount: event.seeded ? players.length - rankedCount : 0
    };
}

function findMatchByPlayer(round, playerId) {
    return round.matches.find(match => match.players[0] === playerId || match.players[1] === playerId) || null;
}

function replacePlayerInRound(round, oldPlayerId, newPlayerId) {
    for (const match of round.matches) {
        for (let i = 0; i < match.players.length; i++) {
            if (match.players[i] === oldPlayerId) {
                match.players[i] = newPlayerId;
                if (!match.winnerId || match.winnerId === oldPlayerId) {
                    match.winnerId = null;
                }
            }
        }
    }

    for (let i = 0; i < round.byes.length; i++) {
        if (round.byes[i] === oldPlayerId) {
            round.byes[i] = newPlayerId;
        }
    }
}

function finishWithChampion(event, championId) {
    event.status = 'finished';
    event.championId = championId;
}

// The grand final decides the event: its winner is champion even though the losing
// finalist is only on one loss. There is no bracket reset.
function getGrandFinalWinner(round) {
    const finalMatch = round.matches.find(match => match.bracket === 'final');
    return finalMatch && finalMatch.winnerId ? finalMatch.winnerId : null;
}

function advanceDoubleRound(event, completedRound) {
    const grandFinalWinner = getGrandFinalWinner(completedRound);
    if (grandFinalWinner) {
        finishWithChampion(event, grandFinalWinner);
        return {
            ok: true,
            roundComplete: true,
            eventFinished: true,
            championId: grandFinalWinner,
            round: completedRound
        };
    }

    const { alive, losses, dropRounds } = getAlivePlayers(event);

    if (alive.length === 1) {
        finishWithChampion(event, alive[0]);
        return {
            ok: true,
            roundComplete: true,
            eventFinished: true,
            championId: alive[0],
            round: completedRound
        };
    }

    const nextRound = buildDoubleRound(alive, losses, completedRound.number + 1, dropRounds);
    event.rounds.push(nextRound);
    event.currentRoundIndex += 1;

    return {
        ok: true,
        roundComplete: true,
        eventFinished: false,
        round: completedRound,
        nextRound
    };
}

// A corrected result changes who is eliminated, so the current round is discarded and
// rebuilt from the new standings instead of swapping players in place.
function rebuildCurrentDoubleRound(event, previousRound) {
    const discarded = event.rounds.pop();
    const { alive, losses, dropRounds } = getAlivePlayers(event);

    if (alive.length === 1) {
        finishWithChampion(event, alive[0]);
        event.currentRoundIndex = event.rounds.length - 1;
        return {
            ok: true,
            correctedNextRound: true,
            roundComplete: true,
            eventFinished: true,
            championId: alive[0],
            round: previousRound
        };
    }

    const rebuilt = buildDoubleRound(alive, losses, discarded.number, dropRounds);
    event.rounds.push(rebuilt);
    event.currentRoundIndex = event.rounds.length - 1;

    return {
        ok: true,
        correctedNextRound: true,
        roundComplete: false,
        round: previousRound,
        currentRound: rebuilt
    };
}

function setWinner(channelId, userId, winnerId) {
    const event = getEvent(channelId);
    if (!event) return { ok: false, reason: 'event_not_found' };
    if (event.hostId !== userId) return { ok: false, reason: 'not_host' };
    if (event.status !== 'active') return { ok: false, reason: 'event_not_active' };

    const currentRound = event.rounds[event.currentRoundIndex];
    let updatedRound = currentRound;
    let updatedMatch = findMatchByPlayer(currentRound, winnerId);
    let correctedNextRound = false;

    // Allow corrections on previous round only if current round has no recorded winners yet.
    if (!updatedMatch && event.currentRoundIndex > 0) {
        const previousRound = event.rounds[event.currentRoundIndex - 1];
        const previousMatch = findMatchByPlayer(previousRound, winnerId);
        const currentRoundHasWinner = currentRound.matches.some(match => !!match.winnerId);

        if (previousMatch && !currentRoundHasWinner) {
            const oldWinner = previousMatch.winnerId;
            previousMatch.winnerId = winnerId;

            if (event.format === EVENT_FORMATS.DOUBLE) {
                return rebuildCurrentDoubleRound(event, previousRound);
            }

            if (oldWinner && oldWinner !== winnerId) {
                replacePlayerInRound(currentRound, oldWinner, winnerId);
            }

            return {
                ok: true,
                correctedNextRound: true,
                roundComplete: false,
                round: previousRound,
                currentRound
            };
        }
    }

    if (!updatedMatch) {
        return { ok: false, reason: 'player_not_in_current_round' };
    }

    updatedMatch.winnerId = winnerId;

    if (!isRoundComplete(updatedRound)) {
        return {
            ok: true,
            correctedNextRound,
            roundComplete: false,
            round: updatedRound,
            updatedMatch
        };
    }

    if (event.format === EVENT_FORMATS.DOUBLE) {
        return advanceDoubleRound(event, updatedRound);
    }

    const advancers = getRoundAdvancers(updatedRound);

    if (advancers.length === 1) {
        event.status = 'finished';
        event.championId = advancers[0];
        return {
            ok: true,
            roundComplete: true,
            eventFinished: true,
            championId: advancers[0],
            round: updatedRound
        };
    }

    const nextRound = buildRound(advancers, updatedRound.number + 1);
    event.rounds.push(nextRound);
    event.currentRoundIndex += 1;

    return {
        ok: true,
        roundComplete: true,
        eventFinished: false,
        round: updatedRound,
        nextRound
    };
}

module.exports = {
    EVENT_FORMATS,
    JOIN_BUTTON_ID,
    JOIN_BUTTON_LABELS,
    formatLabel,
    seedingLabel,
    sortBySeed,
    buildJoinRow,
    respondToJoinRequest,
    createEvent,
    getEvent,
    finishEvent,
    joinEvent,
    startEvent,
    setWinner,
    formatRoundLineup,
    getRoundParticipants
};