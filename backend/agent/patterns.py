from typing import Dict, Any
from collections import defaultdict


# =========================================================
# FAN-OUT
# =========================================================

def detect_fan_out(
    transactions: list[dict],
    account_key: str,
    min_degree: int = 3
) -> Dict[str, Any]:

    outgoing = [
        tx
        for tx in transactions
        if (
            tx.get("from_account_key") == account_key
            and tx.get("to_account_key") != account_key
        )
    ]

    destinations = {
        tx.get("to_account_key")
        for tx in outgoing
        if tx.get("to_account_key")
    }

    degree = len(destinations)

    return {
        "pattern_detected": degree >= min_degree,
        "typology": "FAN-OUT",
        "source_account": account_key,
        "transaction_count": len(outgoing),
        "unique_destinations": degree,
        "evidence": {
            "destination_accounts": sorted(destinations)
        }
    }


# =========================================================
# FAN-IN
# =========================================================

def detect_fan_in(
    transactions: list[dict],
    account_key: str,
    min_degree: int = 3
) -> Dict[str, Any]:

    incoming = [
        tx
        for tx in transactions
        if (
            tx.get("to_account_key") == account_key
            and tx.get("from_account_key") != account_key
        )
    ]

    sources = {
        tx.get("from_account_key")
        for tx in incoming
        if tx.get("from_account_key")
    }

    degree = len(sources)

    return {
        "pattern_detected": degree >= min_degree,
        "typology": "FAN-IN",
        "target_account": account_key,
        "transaction_count": len(incoming),
        "unique_sources": degree,
        "evidence": {
            "source_accounts": sorted(sources)
        }
    }


# =========================================================
# GRAPH BUILDER
# =========================================================

def build_graph(
    transactions: list[dict]
) -> Dict[str, set]:

    graph = defaultdict(set)

    for tx in transactions:

        source = tx.get("from_account_key")
        target = tx.get("to_account_key")

        if not source or not target:
            continue

        graph[source].add(target)

    return graph


# =========================================================
# CYCLE
# =========================================================

def detect_cycle(
    transactions: list[dict],
    account_key: str,
    max_hops: int = 10
) -> Dict[str, Any]:

    graph = build_graph(transactions)

    path = []

    def dfs(current, depth, visited):

        if depth > max_hops:
            return None

        path.append(current)

        for neighbour in graph.get(current, []):

            if neighbour == account_key:
                return path + [account_key]

            if neighbour not in visited:

                result = dfs(
                    neighbour,
                    depth + 1,
                    visited | {neighbour}
                )

                if result:
                    return result

        path.pop()

        return None

    cycle = dfs(
        account_key,
        1,
        {account_key}
    )

    return {
        "pattern_detected": cycle is not None,
        "typology": "CYCLE",
        "source_account": account_key,
        "max_hops": max_hops,
        "evidence": {
            "cycle_path": cycle or []
        }
    }


# =========================================================
# STACK
# =========================================================
def detect_stack(
    transactions: list[dict],
    min_chains: int = 3
) -> Dict[str, Any]:
    """
    Detect STACK.

    STACK patterns consist of multiple independent
    two-edge chains:

        A -> B -> C
        D -> E -> F
        G -> H -> I

    Important:
    Overlapping paths inside a CYCLE are NOT treated
    as STACK chains.
    """

    # -----------------------------------------------------
    # BUILD EDGES
    # -----------------------------------------------------

    edges = [
        (
            tx.get("from_account_key"),
            tx.get("to_account_key")
        )
        for tx in transactions
        if (
            tx.get("from_account_key")
            and tx.get("to_account_key")
            and tx.get("from_account_key")
            != tx.get("to_account_key")
        )
    ]

    # Remove duplicate edges
    edges = list(set(edges))

    # -----------------------------------------------------
    # BUILD GRAPH
    # -----------------------------------------------------

    outgoing = defaultdict(set)

    for source, target in edges:
        outgoing[source].add(target)

    # -----------------------------------------------------
    # CHECK WHETHER AN EDGE BELONGS TO A CYCLE
    # -----------------------------------------------------

    def has_path(
        start: str,
        target: str,
        blocked_edge: tuple[str, str] | None = None
    ) -> bool:

        visited = set()
        stack = [start]

        while stack:

            current = stack.pop()

            if current == target:
                return True

            if current in visited:
                continue

            visited.add(current)

            for neighbor in outgoing.get(
                current,
                set()
            ):

                if (
                    blocked_edge
                    and current == blocked_edge[0]
                    and neighbor == blocked_edge[1]
                ):
                    continue

                if neighbor not in visited:
                    stack.append(neighbor)

        return False

    # -----------------------------------------------------
    # IDENTIFY CYCLE EDGES
    # -----------------------------------------------------

    cycle_edges = set()

    for source, target in edges:

        # An edge source -> target is part of a cycle
        # if target can reach source without using
        # the same edge again.

        if has_path(
            target,
            source,
            blocked_edge=(source, target)
        ):
            cycle_edges.add(
                (source, target)
            )

    # -----------------------------------------------------
    # MAP SOURCE -> DESTINATIONS
    # -----------------------------------------------------

    chains = []

    for source, destinations in outgoing.items():

        for middle in destinations:

            first_edge = (
                source,
                middle
            )

            # Ignore first edge if it belongs to a cycle
            if first_edge in cycle_edges:
                continue

            for destination in outgoing.get(
                middle,
                set()
            ):

                second_edge = (
                    middle,
                    destination
                )

                if destination in {
                    source,
                    middle
                }:
                    continue

                # Ignore second edge if it belongs to a cycle
                if second_edge in cycle_edges:
                    continue

                chains.append(
                    [
                        source,
                        middle,
                        destination
                    ]
                )

    # -----------------------------------------------------
    # REMOVE DUPLICATES
    # -----------------------------------------------------

    unique_chains = []

    seen = set()

    for chain in chains:

        key = tuple(chain)

        if key not in seen:

            seen.add(key)

            unique_chains.append(
                chain
            )

    # -----------------------------------------------------
    # FINAL DETECTION
    # -----------------------------------------------------

    detected = (
        len(unique_chains)
        >= min_chains
    )

    return {
        "pattern_detected": detected,
        "typology": "STACK",
        "chain_count": len(unique_chains),
        "evidence": {
            "chains": unique_chains[:20]
        }
    }
    # -----------------------------------------------------
    # Build directed edges
    # -----------------------------------------------------

    edges = [
        (
            tx.get("from_account_key"),
            tx.get("to_account_key")
        )
        for tx in transactions
        if (
            tx.get("from_account_key")
            and tx.get("to_account_key")
            and tx.get("from_account_key")
            != tx.get("to_account_key")
        )
    ]

    # -----------------------------------------------------
    # Find 2-edge chains: A -> B -> C
    # -----------------------------------------------------

    chains = []

    for source, middle in edges:

        for middle_source, destination in edges:

            if middle_source != middle:
                continue

            if destination in {
                source,
                middle
            }:
                continue

            chains.append([
                source,
                middle,
                destination
            ])

    # Remove duplicates
    unique_chains = []

    seen = set()

    for chain in chains:

        key = tuple(chain)

        if key not in seen:
            seen.add(key)
            unique_chains.append(chain)

    # -----------------------------------------------------
    # Check whether target account participates
    # -----------------------------------------------------

    account_chains = [
        chain
        for chain in unique_chains
        if account_key in chain
    ]

    # -----------------------------------------------------
    # Detection
    # -----------------------------------------------------

    detected = (
        len(account_chains) >= min_chains
    )

    return {
        "pattern_detected": detected,
        "typology": "STACK",
        "source_account": account_key,
        "chain_count": len(account_chains),
        "evidence": {
            "chains": account_chains[:20]
        }
    }
# =========================================================
# SCATTER-GATHER
# =========================================================

def detect_scatter_gather(
    transactions: list[dict],
    account_key: str,
    min_branches: int = 2
) -> Dict[str, Any]:

    outgoing = [
        tx
        for tx in transactions
        if (
            tx.get("from_account_key") == account_key
            and tx.get("to_account_key") != account_key
        )
    ]

    branches = {
        tx.get("to_account_key")
        for tx in outgoing
        if tx.get("to_account_key")
    }

    # Find accounts receiving money from those branches.
    gather_targets = defaultdict(set)

    for tx in transactions:

        source = tx.get("from_account_key")
        target = tx.get("to_account_key")

        if source in branches and target:

            gather_targets[target].add(source)

    candidates = [
        {
            "target": target,
            "branch_count": len(sources),
            "branches": sorted(sources)
        }
        for target, sources in gather_targets.items()
        if len(sources) >= min_branches
    ]

    detected = len(candidates) > 0

    return {
        "pattern_detected": detected,
        "typology": "SCATTER-GATHER",
        "source_account": account_key,
        "branch_count": len(branches),
        "evidence": {
            "branches": sorted(branches),
            "gather_targets": candidates
        }
    }


# =========================================================
# PATTERN ENGINE
# =========================================================

def detect_patterns(
    transactions: list[dict],
    account_key: str
) -> Dict[str, Any]:

    results = []

    detectors = [
        detect_fan_out(
            transactions,
            account_key
        ),

        detect_fan_in(
            transactions,
            account_key
        ),

        detect_cycle(
            transactions,
            account_key
        ),

        detect_stack(
            transactions,
            account_key
        ),

        detect_scatter_gather(
            transactions,
            account_key
        )
    ]

    for result in detectors:

        if result["pattern_detected"]:
            results.append(result)

    return {
        "account_key": account_key,
        "patterns_detected": results,
        "pattern_count": len(results)
    }

def detect_bipartite(
    transactions: list[dict],
    min_edges: int = 4
) -> Dict[str, Any]:
    """
    Detect a BIPARTITE transaction structure.

    A bipartite pattern contains two groups of accounts:

        Sender group  --->  Receiver group

    with transactions occurring between the two groups.
    """

    edges = [
        (
            tx.get("from_account_key"),
            tx.get("to_account_key")
        )
        for tx in transactions
        if (
            tx.get("from_account_key")
            and tx.get("to_account_key")
            and tx.get("from_account_key")
            != tx.get("to_account_key")
        )
    ]

    if not edges:
        return {
            "pattern_detected": False,
            "typology": "BIPARTITE",
            "sender_count": 0,
            "receiver_count": 0,
            "edge_count": 0,
            "evidence": {}
        }

    senders = {
        source
        for source, _ in edges
    }

    receivers = {
        target
        for _, target in edges
    }

    # A clean bipartite structure means the sender and
    # receiver groups do not overlap.
    disjoint_groups = senders.isdisjoint(receivers)

    detected = (
        disjoint_groups
        and len(edges) >= min_edges
        and len(senders) >= 2
        and len(receivers) >= 2
    )

    return {
        "pattern_detected": detected,
        "typology": "BIPARTITE",
        "sender_count": len(senders),
        "receiver_count": len(receivers),
        "edge_count": len(edges),
        "evidence": {
            "senders": sorted(senders),
            "receivers": sorted(receivers),
            "edges": [
                {
                    "from": source,
                    "to": target
                }
                for source, target in edges
            ]
        }
    }
