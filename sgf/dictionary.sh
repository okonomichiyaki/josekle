#!/bin/bash
ruby main.rb $DEPTH $NODES 15081 dictionary.sgf puzzles.json
tr -d "[:space:]" < dictionary.sgf > dictionary2.sgf 
mv dictionary2.sgf dictionary.sgf 
zip -r $NODES.zip $NODES > /dev/null
mv $NODES.zip ~/Dropbox
