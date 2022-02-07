require 'json'
require 'sgf'
require_relative 'scrape.rb'

files = Dir.glob(ARGV[0]+"/*.json")
josekis = files.map { |file| JSON.parse(File.read(file)) }
    .filter { |json| joseki? json }
    .map do |json|
        play = json["play"] # string like .root.Q16.P17.R18...
        moves = play.split(".")[2..] # skip "root" and leading empty string
        # convert to sgf notation:
        nodes = moves.each_with_index.map do |move,depth| 
            placement = ogs2sgf(move)
            node = SGF::Node.new()
            node.add_properties({color(depth+1) => placement})
            node
        end
        # stitch nodes together:
        root = nodes[0]
        parent = root
        nodes[1..].each do |child|
            parent.add_children(child)
            parent = child
        end
        tree = SGF::Gametree.new(root)
        coll = SGF::Collection.new()
        coll << tree
        sgf = coll.to_s.split("")
            .filter { |c| c != " " && c != "\n" }
            .join("")
        out = {}
        out["node_id"] = json["node_id"]
        out["sgf"] = sgf
        #out["length"] = nodes.length + 1
        out
    end
print JSON.unparse(josekis)
