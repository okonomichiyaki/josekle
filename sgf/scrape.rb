require 'resolv-replace'
require 'net/http'
require 'json'
require 'sgf'
require_relative 'fetch_position.rb'

# col: A-T, without I
# row: 1-19
# returns SGF format: a-t (including i)
def ogs2sgf(placement)
    col = placement[0].downcase
    row = placement[1..].to_i
    col = if col.ord <= "h".ord then col else (col.ord-1).chr end
    row = ("a".ord+19-row).chr
    col+row
end
# col: A-T, without I
# row: 1-19
# returns BesoGo extract move format: 1-19
def ogs2besogo(placement)
    col = placement[0].downcase
    col = if col.ord <= "h".ord then col.ord else col.ord-"a".ord end
    row = 19-placement[1..].to_i+1
    {:x=>col,:y=>row}
end
def save_sgf(root_node, out_file)
    tree = SGF::Gametree.new(root_node)
    coll = SGF::Collection.new()
    coll << tree
    coll.save(out_file)
end
def save_puzzles(puzzles, out_file)
    json = JSON.unparse(puzzles)
    File.open(out_file, 'w') { |file| file.write(json) }
end

def try_read_file(name)
    begin
        File.read(name)
    rescue
        nil
    end
end

class ExplorerPosition
    attr_accessor :node_id
    def initialize node_id,json
        @json = json # new OJE API returns a list of nodes, which includes the requested node, along with its children
        @node_id = node_id
    end
    def get_position
        @json.find do |position|
            position["node_id"] == @node_id
        end
    end
    def next_moves
        @json.filter do |position|
            position["node_id"] != @node_id
        end
    end
    def placement
        position = get_position()
        position["placement"]
    end
    def tag?(name)
        position = get_position()
        tags = position["tags"]
        tags && tags.any? { |tag| tag["description"] == name }
    end
    def joseki?
        tag?("Joseki: Done")
    end
    def current?
        tag?("Current")
    end
    def basic?
        tag?("Basic")
    end
    def contains_pass?
        oje_string().include? "pass"
    end
    def oje_string
        position = get_position()
        position["play"]
    end
end

def load_position(id,dir)
    if (not dir.end_with? "/")
        dir = dir + "/"
    end
    from_file = try_read_file("#{dir}#{id}.json")
    if from_file
        print "read ##{id} from disk\n"
        return ExplorerPosition.new(id,JSON.parse(from_file))
    end
    tries = 0
    json = nil
    wait = 5
    while (json.nil? && tries <= 5)
        print "fetch ##{id} from OGS#{if tries>0 then ", retry#"+tries else "" end}\n"
        sleep wait
        json = fetch_position(id)
        if (json.nil?)
            tries = tries
            wait = wait*2
        end
    end
    if (json.nil?)
        puts "failed to fetch ##{id} after retries\n"
        exit
    end
    parsed = JSON.parse(json)
    if (parsed.nil?)
        puts "failed to parse: \"#{json}\"\n"
        exit
    end
    ExplorerPosition.new(id,parsed)
end

def follow?(move)
    categories = ["GOOD","IDEAL"]
    categories.include?(move["category"]) && move["variation_label"] != "_"
end

def joseki?(node)
    tags = node["tags"]
    tags && tags.any? { |tag| tag["description"] == "Joseki: Done" }
end

def color(depth)
    if depth.odd? then "B" else "W" end
end

def explore(moves, parent, depth)
    moves.filter { |move| follow? move }
        .map { |move| {:depth => depth, :parent => parent, :move => move} }
end

def scrape(start,dir,max_depth)
    puzzles = []
    root_position = load_position(start,dir)
    root_node = SGF::Node.new()
    next_moves = root_position.next_moves()
    work_queue = explore(next_moves, root_node, 1)
    
    while (not work_queue.empty?) do
        work = work_queue.pop
        depth = work[:depth]
        move = work[:move]
        parent = work[:parent]
        node_id = move["node_id"]

        placement = ogs2sgf(move["placement"])
        child = SGF::Node.new()
        child.add_properties({color(depth) => placement, "C" => node_id})
        if joseki?(move) && !move["play"].include?("pass")
            puzzles.push({:oje_string=>move["play"],:oje_node_id=>node_id})
        end
        parent.add_children(child)

        if (depth + 1 <= max_depth)
            position = load_position(node_id,dir)
            next_moves = position.next_moves()
            if next_moves
                explore(next_moves, child, depth+1).each do |move|
                    work_queue.push(move)
                end
            end
        end
    end
    {:dictionary => root_node, :puzzles => puzzles}
end

