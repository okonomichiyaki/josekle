#!/bin/bash
ruby main.rb $DEPTH dictionary.sgf $NODES 15081
tr -d "[:space:]" < dictionary.sgf > dictionary2.sgf 
mv dictionary2.sgf dictionary.sgf 
