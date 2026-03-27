#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::{Address as _, Events}, Address, Env, String, Bytes, symbol_short};

#[test]
fn test_send_message() {
    let env = Env::default();
    let contract_id = env.register(CrossChainHandler, ());
    let client = CrossChainHandlerClient::new(&env, &contract_id);

    let sender = Address::generate(&env);
    let destination_chain = symbol_short!("ETH");
    let destination_address = String::from_str(&env, "0x1234...");
    let payload = Bytes::from_slice(&env, &[0, 1, 2, 3]);

    env.mock_all_auths();

    let first_nonce = client.send_message(&sender, &destination_chain, &destination_address, &payload);
    assert_eq!(first_nonce, 1);
    assert_eq!(client.get_nonce(), 1);

    let second_nonce = client.send_message(&sender, &destination_chain, &destination_address, &payload);
    assert_eq!(second_nonce, 2);
    assert_eq!(client.get_nonce(), 2);

    let events = env.events().all();
    assert_eq!(events.len(), 2);
}
