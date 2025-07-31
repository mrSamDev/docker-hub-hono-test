import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

interface Todo {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority: "low" | "medium" | "high";
  createdAt: Date;
  updatedAt: Date;
  dueDate?: Date;
}

interface CreateTodoRequest {
  title: string;
  description?: string;
  priority?: "low" | "medium" | "high";
  dueDate?: string;
}

interface UpdateTodoRequest {
  title?: string;
  description?: string;
  completed?: boolean;
  priority?: "low" | "medium" | "high";
  dueDate?: string;
}

// In-memory storage (use database in production)
let todos: Todo[] = [];
let nextId = 1;

const app = new Hono();

// Middleware
app.use("*", logger());
app.use("*", cors());

// Helper functions
const generateId = (): string => (nextId++).toString();

const findTodoById = (id: string): Todo | undefined => {
  return todos.find((todo) => todo.id === id);
};

const validateTodo = (data: any): string[] => {
  const errors: string[] = [];

  if (!data.title || typeof data.title !== "string" || !data.title.trim()) {
    errors.push("Title is required and must be a non-empty string");
  }

  if (data.priority && !["low", "medium", "high"].includes(data.priority)) {
    errors.push("Priority must be one of: low, medium, high");
  }

  if (data.dueDate && isNaN(Date.parse(data.dueDate))) {
    errors.push("Due date must be a valid date string");
  }

  return errors;
};

// Routes
app.get("/", (c) => {
  return c.json({
    message: "Todo API",
    endpoints: {
      "GET /todos": "Get all todos (supports ?completed, ?priority, ?search)",
      "POST /todos": "Create a new todo",
      "GET /todos/:id": "Get a specific todo",
      "PUT /todos/:id": "Update a todo",
      "DELETE /todos/:id": "Delete a todo",
      "GET /stats": "Get todo statistics",
    },
  });
});

// Get all todos with optional filtering
app.get("/todos", (c) => {
  const completed = c.req.query("completed");
  const priority = c.req.query("priority");
  const search = c.req.query("search");
  const sortBy = c.req.query("sortBy") || "createdAt";
  const order = c.req.query("order") || "desc";

  let filteredTodos = [...todos];

  // Filter by completion status
  if (completed !== undefined) {
    const isCompleted = completed.toLowerCase() === "true";
    filteredTodos = filteredTodos.filter((todo) => todo.completed === isCompleted);
  }

  // Filter by priority
  if (priority && ["low", "medium", "high"].includes(priority)) {
    filteredTodos = filteredTodos.filter((todo) => todo.priority === priority);
  }

  // Search in title and description
  if (search) {
    const searchLower = search.toLowerCase();
    filteredTodos = filteredTodos.filter((todo) => todo.title.toLowerCase().includes(searchLower) || todo.description?.toLowerCase().includes(searchLower));
  }

  // Sort todos
  filteredTodos.sort((a, b) => {
    let aVal, bVal;

    switch (sortBy) {
      case "title":
        aVal = a.title.toLowerCase();
        bVal = b.title.toLowerCase();
        break;
      case "priority":
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        aVal = priorityOrder[a.priority];
        bVal = priorityOrder[b.priority];
        break;
      case "dueDate":
        aVal = a.dueDate ? new Date(a.dueDate).getTime() : 0;
        bVal = b.dueDate ? new Date(b.dueDate).getTime() : 0;
        break;
      default:
        aVal = new Date(a.createdAt).getTime();
        bVal = new Date(b.createdAt).getTime();
    }

    if (order === "asc") {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  return c.json({
    todos: filteredTodos,
    total: filteredTodos.length,
    filters: { completed, priority, search, sortBy, order },
  });
});

// Create a new todo
app.post("/todos", async (c) => {
  try {
    const body: CreateTodoRequest = await c.req.json();

    const errors = validateTodo(body);
    if (errors.length > 0) {
      return c.json({ error: "Validation failed", details: errors }, 400);
    }

    const now = new Date();
    const newTodo: Todo = {
      id: generateId(),
      title: body.title.trim(),
      description: body.description?.trim(),
      completed: false,
      priority: body.priority || "medium",
      createdAt: now,
      updatedAt: now,
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
    };

    todos.push(newTodo);

    return c.json({ message: "Todo created successfully", todo: newTodo }, 201);
  } catch (error) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
});

// Get a specific todo
app.get("/todos/:id", (c) => {
  const id = c.req.param("id");
  const todo = findTodoById(id);

  if (!todo) {
    return c.json({ error: "Todo not found" }, 404);
  }

  return c.json({ todo });
});

// Update a todo
app.put("/todos/:id", async (c) => {
  try {
    const id = c.req.param("id");
    const body: UpdateTodoRequest = await c.req.json();

    const todo = findTodoById(id);
    if (!todo) {
      return c.json({ error: "Todo not found" }, 404);
    }

    // Validate if title is being updated
    if (body.title !== undefined) {
      const errors = validateTodo({ title: body.title });
      if (errors.length > 0) {
        return c.json({ error: "Validation failed", details: errors }, 400);
      }
    }

    // Update fields
    if (body.title !== undefined) todo.title = body.title.trim();
    if (body.description !== undefined) todo.description = body.description?.trim();
    if (body.completed !== undefined) todo.completed = body.completed;
    if (body.priority !== undefined) todo.priority = body.priority;
    if (body.dueDate !== undefined) {
      todo.dueDate = body.dueDate ? new Date(body.dueDate) : undefined;
    }

    todo.updatedAt = new Date();

    return c.json({ message: "Todo updated successfully", todo });
  } catch (error) {
    return c.json({ error: "Invalid JSON body" }, 400);
  }
});

// Delete a todo
app.delete("/todos/:id", (c) => {
  const id = c.req.param("id");
  const todoIndex = todos.findIndex((todo) => todo.id === id);

  if (todoIndex === -1) {
    return c.json({ error: "Todo not found" }, 404);
  }

  const deletedTodo = todos.splice(todoIndex, 1)[0];
  return c.json({ message: "Todo deleted successfully", todo: deletedTodo });
});

// Get todo statistics
app.get("/stats", (c) => {
  const total = todos.length;
  const completed = todos.filter((todo) => todo.completed).length;
  const pending = total - completed;

  const byPriority = {
    high: todos.filter((todo) => todo.priority === "high").length,
    medium: todos.filter((todo) => todo.priority === "medium").length,
    low: todos.filter((todo) => todo.priority === "low").length,
  };

  const overdue = todos.filter((todo) => todo.dueDate && new Date(todo.dueDate) < new Date() && !todo.completed).length;

  return c.json({
    total,
    completed,
    pending,
    overdue,
    byPriority,
  });
});

// 404 handler
app.notFound((c) => {
  return c.json({ error: "Route not found" }, 404);
});

// Error handler
app.onError((err, c) => {
  console.error("Error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

const PORT = (process.env.PORT || 3000) as number;
console.log("PORT: ", PORT);

serve(
  {
    fetch: app.fetch,
    port: PORT,
  },
  (info) => {
    console.log(`Todo API server running on http://localhost:${info.port}`);
  }
);
