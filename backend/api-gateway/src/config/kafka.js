const { Kafka, logLevel, Partitioners } = require("kafkajs");
const { env } = require("./env");
const { logger } = require("../utils/logger");

let producer = null;

const kafka = new Kafka({
  clientId: env.KAFKA_CLIENT_ID,
  brokers: env.KAFKA_BROKERS,
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 300,
    retries: 3,
    maxRetryTime: 3000,
  },
});

async function connectKafkaProducer() {
  try {
    producer = kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
      createPartitioner: Partitioners.LegacyPartitioner,
    });
    await producer.connect();
    logger.info("Kafka producer connected");
  } catch (err) {
    // Do not crash the gateway if Kafka is temporarily unavailable.
    // Downstream logic will fall back to requestProcessor when needed.
    logger.error({ err }, "Kafka producer connection failed — continuing without Kafka");
    producer = null;
  }
}

async function publishEvent(topic, key, value) {
  if (!producer) {
    return false;
  }
  try {
    await producer.send({
      topic,
      messages: [
        {
          key: String(key),
          value: JSON.stringify(value),
          timestamp: String(Date.now()),
        },
      ],
    });
    return true;
  } catch (err) {
    logger.error({ err, topic, key }, "Failed to publish Kafka event");
    return false;
  }
}

function getProducer() {
  return producer;
}

// Kafka topics
const TOPICS = {
  ALLOCATION_REQUESTS: "schedulord.allocation.requests",
  ALLOCATION_RESULTS: "schedulord.allocation.results",
  SYSTEM_EVENTS: "schedulord.system.events",
  ANALYTICS: "schedulord.analytics",
};

module.exports = { connectKafkaProducer, publishEvent, getProducer, TOPICS, kafka };
