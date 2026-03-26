#![cfg(test)]
use crate::{DaoGovernance, DaoGovernanceClient, ProposalStatus};
use soroban_sdk::{testutils::{Address as _, Ledger}, token, Address, Env, symbol_short, Symbol};

#[test]
fn test_proposal_lifecycle() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let voter = Address::generate(&env);
    
    // Deploy dummy token
    let token_addr = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::Client::new(&env, &token_addr);
    token_client.mint(&voter, &500);

    // Deploy Governance
    let gov_id = env.register(&DaoGovernance, ());
    let gov_client = DaoGovernanceClient::new(&env, &gov_id);

    let min_voting_period = 100;
    let timelock_delay = 3600;
    let quorum = 100;

    gov_client.initialize(&admin, &token_addr, &min_voting_period, &timelock_delay, &quorum);

    // 1. Create Proposal
    let description = symbol_short!("test_pro");
    let proposal_id = gov_client.create_proposal(&voter, &description);
    
    assert_eq!(proposal_id, 1);
    assert_eq!(gov_client.get_status(&proposal_id), ProposalStatus::Active);

    // 2. Vote
    gov_client.vote(&voter, &proposal_id, &true);
    
    let proposal = gov_client.get_proposal(&proposal_id);
    assert_eq!(proposal.votes_for, 500);
    assert_eq!(proposal.votes_against, 0);

    // 3. Move ledger to end voting
    env.ledger().set_sequence(env.ledger().sequence() + min_voting_period + 1);
    assert_eq!(gov_client.get_status(&proposal_id), ProposalStatus::Succeeded);

    // 4. Queue
    gov_client.queue_proposal(&proposal_id);
    assert_eq!(gov_client.get_status(&proposal_id), ProposalStatus::Queued);

    // 5. Move time for timelock
    env.ledger().set_timestamp(env.ledger().timestamp() + timelock_delay + 1);
    
    // Status is still Queued (ready for execution)
    assert_eq!(gov_client.get_status(&proposal_id), ProposalStatus::Queued);

    // 6. Execute
    gov_client.execute_proposal(&proposal_id);
    assert_eq!(gov_client.get_status(&proposal_id), ProposalStatus::Executed);

    let final_proposal = gov_client.get_proposal(&proposal_id);
    assert!(final_proposal.executed);
}

#[test]
#[should_panic(expected = "Proposal failed")]
fn test_failed_proposal() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let voter = Address::generate(&env);
    
    let token_addr = env.register_stellar_asset_contract_v2(token_admin.clone()).address();
    let token_client = token::Client::new(&env, &token_addr);
    token_client.mint(&voter, &50); // Less than quorum

    let gov_id = env.register(&DaoGovernance, ());
    let gov_client = DaoGovernanceClient::new(&env, &gov_id);

    gov_client.initialize(&admin, &token_addr, &100, &3600, &100);

    let proposal_id = gov_client.create_proposal(&voter, &symbol_short!("fail"));
    gov_client.vote(&voter, &proposal_id, &true);

    env.ledger().set_sequence(env.ledger().sequence() + 101);
    assert_eq!(gov_client.get_status(&proposal_id), ProposalStatus::Failed);

    gov_client.queue_proposal(&proposal_id); // Should panic
}

#[test]
#[should_panic(expected = "Already voted")]
fn test_double_voting() {
    let env = Env::default();
    env.mock_all_auths();

    let admin = Address::generate(&env);
    let token_admin = Address::generate(&env);
    let voter = Address::generate(&env);
    
    let token_addr = env.register_stellar_asset_contract_v2(token_admin).address();
    let token_client = token::Client::new(&env, &token_addr);
    token_client.mint(&voter, &500);

    let gov_id = env.register(&DaoGovernance, ());
    let gov_client = DaoGovernanceClient::new(&env, &gov_id);

    gov_client.initialize(&admin, &token_addr, &100, &3600, &100);

    let proposal_id = gov_client.create_proposal(&voter, &symbol_short!("dbl"));
    gov_client.vote(&voter, &proposal_id, &true);
    gov_client.vote(&voter, &proposal_id, &true); // Should panic
}
