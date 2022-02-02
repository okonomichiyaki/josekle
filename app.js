const debug = window.location.href.includes("debug=true");
const GREEN = "🟢";
const WHITE = "⚪";
const YELLOW = "🟡";
const ROTATE = "🔄";

var guesses=[];
var today = getNumber();

function getNumber() {
    const dayMillis = 24 * 60 * 60 * 1000; // hours*minutes*seconds*milliseconds
    const start = new Date(2022, 1, 1);
    const today = new Date();
    return Math.round(Math.abs((start - today) / dayMillis));
}
function getSolution() {
    return puzzles[today % puzzles.length];
}
function extractMoves() {
    var inputBoard=document.querySelector("#input-board");
    var current=inputBoard.editor.getCurrent();
    var moves=[];
    while (current.move !== null) {
        moves.push({x:current.move.x, y:current.move.y});
        current=current.parent;
    }
    return moves.reverse();
}
function pretty_print(moves) {
    return moves.map(move => move.x+"-"+move.y).join(", ");
}
function isYellow(candidate, solution) {
    return solution.find(move => move.x===candidate.x && move.y===candidate.y);
}
function check(moves, solution) {
    var limit = Math.min(moves.length, solution.length);
    var output=[];
    for (i=0;i<limit;i++) {
        var move=moves[i];
        var correct=solution[i];
        if (move.x===correct.x && move.y===correct.y) {
            output.push(GREEN);
        } else if (isYellow(move, solution)) {
            output.push(YELLOW);
        } else {
            output.push(WHITE);
        }
    }
    return output;
}
function reflect(moves) {
    return moves.map(move => {
        return {x:move.y, y:move.x};
    });
}
function normalize(moves) {
    return moves.map(normalize_move);
}
function normalize_move(move) {
    var x = move.x;
    var y = move.y;
    if (move.x > 10) {
        x=19-move.x+1;
    }
    if (move.y > 10) {
        y=19-move.y+1;
    }
    return {x:x, y:y};
}
function better(a, b) {
    var ayellows = a.filter(x => x === YELLOW).length;
    var byellows = b.filter(x => x === YELLOW).length;
    var agreens = a.filter(x => x === GREEN).length;
    var bgreens = b.filter(x => x === GREEN).length;
    return (ayellows + agreens*2) > (byellows + bgreens*2);
}
function wasCorrect(hints, solution) {
    for (i=0;i<hints.length;i++) {
        if (hints[i]===YELLOW || hints[i]===WHITE) {
            return false;
        }
    }
    return solution.length === hints.length;
}
function share() {
    var text = "Josekle #" + today + "\n";
    text += guesses.map(guess => guess.join("")).join("\n");
    navigator.clipboard.writeText(text);
}
function toggleButtons() {
    document.querySelector("button#share").classList.remove("hide");
    document.querySelector("button#submit").classList.add("hide");
}
function display(message) {
    var output = document.querySelector("#output");
    var p = document.createElement("p");
    p.innerText=message;
    output.appendChild(p);
}
function submit() {
    var moves = extractMoves();
    var solution = getSolution();
    if (debug) {
        console.log("guess: " + pretty_print(normalize(moves)));
        console.log("solution: " + pretty_print(normalize(solution)));
    }
    var hints = check(normalize(moves), normalize(solution));
    var hints_rotated = check(reflect(normalize(moves)), normalize(solution));
    if (better(hints_rotated, hints)) {
        hints = hints_rotated;
        hints.push(ROTATE);
    }
    guesses.push(hints);
    var message=hints.join("");
    if (moves.length < solution.length) {
        message+=" too few moves";
    } else if (moves.length > solution.length) {
        message+=" too many moves";
    }
    if (wasCorrect(hints, solution)) {
        message+=" correct!";
        toggleButtons();
    }
    display(message);
}
function getPuzzle() {
    console.log(JSON.stringify(extractMoves()));
}
function tomorrow() {
    today++;
}
window.onload = function() {
    besogo.autoInit();
    document.querySelector("div#title").innerText="Josekle #"+today;
    if (debug) {
        document.querySelector("button#puzzle").classList.remove("hide");
        document.querySelector("button#tomorrow").classList.remove("hide");
    }
};
