#![cfg(test)]
use super::*;
use soroban_sdk::testutils::Events;
use soroban_sdk::{vec, Env};

#[test]
fn test_event_emission() {
    let env = Env::default();
    let contract_id = env.register_contract(None, EventContract);
    let client = EventContractClient::new(&env, &contract_id);

    client.trigger_event(&symbol_short!("hello"));

    let events = env.events().all();
    assert_eq!(events.len(), 1);
}
