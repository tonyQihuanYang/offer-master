# Flink image + the Kafka SQL connector jar (the one extra dependency the SQL job needs).
FROM flink:1.18.1-scala_2.12-java11

# ADD can fetch a URL directly (no curl/wget needed in the base image).
ADD https://repo1.maven.org/maven2/org/apache/flink/flink-sql-connector-kafka/3.1.0-1.18/flink-sql-connector-kafka-3.1.0-1.18.jar /opt/flink/lib/flink-sql-connector-kafka.jar
RUN chmod 644 /opt/flink/lib/flink-sql-connector-kafka.jar
