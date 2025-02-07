import { addMessages } from "@langchain/langgraph";

export const prettyPrintMessages = (update: Record<string, any>) => {
   // Handle tuple case with namespace
   if (Array.isArray(update)) {
     const [ns, updateData] = update;
     // Skip parent graph updates in the printouts
     if (ns.length === 0) {
       return;
     }

     const graphId = ns[ns.length - 1].split(":")[0];
     console.log(`Update from subgraph ${graphId}:\n`);
     update = updateData;
   }

   if (update.__metadata__?.cached) {
     return;
   }
   // Print updates for each node
   for (const [nodeName, updateValue] of Object.entries(update)) {
     console.log(`Update from node ${nodeName}:\n`);

     const coercedMessages = addMessages([], updateValue.messages);
     for (const message of coercedMessages) {
       const textContent = typeof message.content === "string"
         ? message.content
         : JSON.stringify(message.content);
       // Print message content based on role
       if (message.getType() === "ai") {
         console.log("=".repeat(33) + " Assistant Message " + "=".repeat(33));
         console.log(textContent);
         console.log();
       } else if (message.getType() === "human") {
         console.log("=".repeat(33) + " Human Message " + "=".repeat(33));
         console.log(textContent);
         console.log();
       } else if (message.getType() === "tool") {
         console.log("=".repeat(33) + " Tool Message " + "=".repeat(33));
         console.log(textContent);
         console.log();
       }
     }
     console.log("\n");
   }
 };
