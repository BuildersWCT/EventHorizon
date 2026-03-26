#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env, Symbol, Vec, symbol_short, log};

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProposalStatus {
    Pending,
    Active,
    Succeeded,
    Failed,
    Queued,
    Executed,
    Expired,
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct Proposal {
    pub id: u64,
    pub proposer: Address,
    pub description: Symbol,
    pub votes_for: i128,
    pub votes_against: i128,
    pub start_block: u32,
    pub end_block: u32,
    pub execution_time: u64, // Timelock execution timestamp
    pub executed: bool,
}

#[contracttype]
pub enum DataKey {
    Admin,
    GovernanceToken,
    MinVotingPeriod, // in blocks
    TimelockDelay,   // in seconds
    Quorum,          // min votes for
    ProposalCount,
    Proposal(u64),
    Voted(u64, Address),
}

#[contract]
pub struct DaoGovernance;

#[contractimpl]
impl DaoGovernance {
    pub fn initialize(
        env: Env,
        admin: Address,
        token: Address,
        min_voting_period: u32,
        timelock_delay: u64,
        quorum: i128,
    ) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::GovernanceToken, &token);
        env.storage().instance().set(&DataKey::MinVotingPeriod, &min_voting_period);
        env.storage().instance().set(&DataKey::TimelockDelay, &timelock_delay);
        env.storage().instance().set(&DataKey::Quorum, &quorum);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);
    }

    pub fn create_proposal(env: Env, proposer: Address, description: Symbol) -> u64 {
        proposer.require_auth();

        let count: u64 = env.storage().instance().get(&DataKey::ProposalCount).unwrap_or(0);
        let proposal_id = count + 1;

        let min_voting_period: u32 = env.storage().instance().get(&DataKey::MinVotingPeriod).unwrap();
        let start_block = env.ledger().sequence();
        let end_block = start_block + min_voting_period;

        let proposal = Proposal {
            id: proposal_id,
            proposer: proposer.clone(),
            description: description.clone(),
            votes_for: 0,
            votes_against: 0,
            start_block,
            end_block,
            execution_time: 0,
            executed: false,
        };

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().instance().set(&DataKey::ProposalCount, &proposal_id);

        env.events().publish(
            (Symbol::new(&env, "proposal_created"), proposal_id),
            (proposer, description)
        );

        proposal_id
    }

    pub fn vote(env: Env, voter: Address, proposal_id: u64, support: bool) {
        voter.require_auth();

        let mut proposal: Proposal = env.storage().persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("Proposal not found");

        let current_block = env.ledger().sequence();
        if current_block < proposal.start_block || current_block > proposal.end_block {
            panic!("Voting is not active");
        }

        let voted_key = DataKey::Voted(proposal_id, voter.clone());
        if env.storage().persistent().has(&voted_key) {
            panic!("Already voted");
        }

        let token_addr: Address = env.storage().instance().get(&DataKey::GovernanceToken).unwrap();
        let token_client = token::Client::new(&env, &token_addr);
        let voting_power = token_client.balance(&voter);

        if voting_power <= 0 {
            panic!("No voting power");
        }

        if support {
            proposal.votes_for += voting_power;
        } else {
            proposal.votes_against += voting_power;
        }

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage().persistent().set(&voted_key, &true);

        env.events().publish(
            (Symbol::new(&env, "vote_cast"), proposal_id, voter),
            (support, voting_power)
        );
    }

    pub fn queue_proposal(env: Env, proposal_id: u64) {
        let mut proposal: Proposal = env.storage().persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("Proposal not found");

        let current_block = env.ledger().sequence();
        if current_block <= proposal.end_block {
            panic!("Voting still ongoing");
        }

        let quorum: i128 = env.storage().instance().get(&DataKey::Quorum).unwrap();
        if proposal.votes_for <= proposal.votes_against || proposal.votes_for < quorum {
            panic!("Proposal failed");
        }

        if proposal.execution_time > 0 {
            panic!("Proposal already queued");
        }

        let delay: u64 = env.storage().instance().get(&DataKey::TimelockDelay).unwrap();
        proposal.execution_time = env.ledger().timestamp() + delay;

        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        env.events().publish(
            (symbol_short!("prop_que"), proposal_id),
            proposal.execution_time
        );
    }

    pub fn execute_proposal(env: Env, proposal_id: u64) {
        let mut proposal: Proposal = env.storage().persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("Proposal not found");

        if proposal.executed {
            panic!("Already executed");
        }

        if proposal.execution_time == 0 {
            panic!("Proposal not queued");
        }

        if env.ledger().timestamp() < proposal.execution_time {
            panic!("Timelock not expired");
        }

        proposal.executed = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        env.events().publish(
            (symbol_short!("prop_exe"), proposal_id),
            true
        );
    }

    pub fn get_proposal(env: Env, proposal_id: u64) -> Proposal {
        env.storage().persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("Proposal not found")
    }

    pub fn get_status(env: Env, proposal_id: u64) -> ProposalStatus {
        let proposal: Proposal = env.storage().persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("Proposal not found");

        if proposal.executed {
            return ProposalStatus::Executed;
        }

        let current_block = env.ledger().sequence();
        if current_block < proposal.start_block {
            return ProposalStatus::Pending;
        }
        if current_block <= proposal.end_block {
            return ProposalStatus::Active;
        }

        let quorum: i128 = env.storage().instance().get(&DataKey::Quorum).unwrap();
        if proposal.votes_for <= proposal.votes_against || proposal.votes_for < quorum {
            return ProposalStatus::Failed;
        }

        if proposal.execution_time == 0 {
            return ProposalStatus::Succeeded;
        }

        if env.ledger().timestamp() >= proposal.execution_time {
            return ProposalStatus::Queued; // Or it could be executed
        }

        ProposalStatus::Queued
    }
}

mod test;
