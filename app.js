const debug = window.location.href.includes("debug=true");
const GREEN = "🟢";
const WHITE = "⚪";
const YELLOW = "🟡";
const ROTATE = "🔄";

var guesses=[];
var today = getNumber();

function getNumber() {
    const re=/puzzle=(\d+)/;
    var m;
    if ((m = window.location.href.match(re)) && m.length > 1) {
        return parseInt(m[1]);
    }
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
    if (current.markup.length > 0) {
        return []; // Detects if there are already hints
    }
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
    var output = [];
    var inputBoard=document.querySelector("#input-board");
    for (i = 0; i < moves.length; i++) {
        var move = moves[i];
        if (i < solution.length && move.x === solution[i].x && move.y === solution[i].y) {
            output.push(GREEN);
            inputBoard.editor.setHint(move.x, move.y, 1);
        } else if (isYellow(move, solution)) {
            output.push(YELLOW);
            inputBoard.editor.setHint(move.x, move.y, 2);
        } else {
            output.push(WHITE);
            inputBoard.editor.setHint(move.x, move.y, 3);
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
    if (moves.length === 0) {
        return;
    }
    var solution = getSolution();
    if (debug) {
        console.log("guess: " + pretty_print(moves));
        console.log("solution: " + pretty_print(solution));
    }
    var hints = check(moves, solution);
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

// utilities for collecting josekis:
var collection=[];
function addPuzzle() {
    collection.push(JSON.stringify(extractMoves()));
}
function copyPuzzles() {
    var text = collection.join(",\n");
    navigator.clipboard.writeText(text);
}
window.onload = function() {
    besogo.autoInit();
    document.querySelector("div#title").innerText="Josekle #"+today;
    if (debug) {
        document.querySelector("button#addPuzzle").classList.remove("hide");
        document.querySelector("button#copyPuzzles").classList.remove("hide");
    }
};
