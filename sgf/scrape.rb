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
def save_sgf(root_node, out_file)
    tree = SGF::Gametree.new(root_node)
    coll = SGF::Collection.new()
    coll << tree
    coll.save(out_file)
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
        @json = json
        @node_id = node_id
    end
    def get_position
        @json.find do |position|
            position["node_id"] == @node_id
        end
    end
    def next_moves
        position = get_position()
        position["next_moves"]
    end
    def placement
        position = get_position()
        position["placement"]
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
    File.open(dir + "#{id}.json", 'w') { |file| file.write(json) }
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
    root_node
end

