<script setup lang="ts">
import { ref, toRaw } from "vue";
import { useFinanceStore } from "@/stores/finance";
import { isProtectedAccountTypeName, isProtectedCategoryName, type AccountType, type CategorizationRule, type Category } from "@/types";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import ErrorModal from "@/components/ErrorModal.vue";
import CategoryModal from "./components/CategoryModal.vue";
import AccountTypeModal from "./components/AccountTypeModal.vue";
import RuleModal from "./components/RuleModal.vue";

const store = useFinanceStore();

const confirmModal = ref<InstanceType<typeof ConfirmationModal>>();

const showAccountTypeModal = ref(false);
const showCategoryModal = ref(false);
const editingCategory = ref(false);
const editingAccountType = ref(false);

const categoryForm = ref<
  Category
>({
  id: 0,
  name: "",
  colorCode: "",
  icon: "",
  type: "expense",
});

const accountTypeForm = ref<
  AccountType
>({
  id: 0,
  type: "",
  classification: "liquid",
});

const showRuleModal = ref(false);
const editingRule = ref(false);

const ruleForm = ref<CategorizationRule>({
  id: 0,
  pattern: "",
  matchType: "contains",
  categoryId: 0,
  priority: 0,
  isActive: true,
});

const matchTypeLabels: Record<CategorizationRule["matchType"], string> = {
  contains: "contains",
  startsWith: "starts with",
  equals: "equals",
};

function ruleCategory(rule: CategorizationRule): Category | undefined {
  return store.categories.find((c) => c.id === rule.categoryId);
}

// Delete category
async function deleteCategory(id: number) {
  if (
    await confirmModal.value?.openConfirmation({
      title: "Delete Category",
      message: "Are you sure you want to delete this category?",
      cancelText: "Cancel",
      confirmText: "Delete",
    }
  )
  ) {
    await store.removeCategory(id);
  }
}

async function deleteAccountType(id: number) {
  if (
    await confirmModal.value?.openConfirmation({
      title: "Delete Account Type",
      message: "Are you sure you want to delete this account type?",
      cancelText: "Cancel",
      confirmText: "Delete",
    }
  )
  ) {
    await store.removeAccountType(id);
  }
}

// Open create modal
function openCategoryCreateModal() {
  editingCategory.value = false;
  categoryForm.value = {
    id: 0,
    name: "",
    colorCode: "#6366f1",
    icon: "pi-tag",
    type: "expense",
  };
  showCategoryModal.value = true;
}

function openAccountTypeCreateModal() {
  editingAccountType.value = false;
  accountTypeForm.value = {
    id: 0,
    type: "",
    classification: "liquid",
  };
  showAccountTypeModal.value = true;
}

// Open edit modal
function openCategoryEditModal(category: Category) {
  editingCategory.value = true;
  categoryForm.value = category;
  showCategoryModal.value = true;
}

function openAccountTypeEditModal(accountType: AccountType) {
  editingAccountType.value = true;
  accountTypeForm.value = accountType;
  showAccountTypeModal.value = true;
}

async function saveCategory(categoryForm: Category) {
  if (!categoryForm.name.trim()) return;

  try {
    if (editingCategory.value) {
      await store.editCategory(
        categoryForm.id,
        categoryForm.name,
        categoryForm.colorCode,
        categoryForm.icon,
        categoryForm.type
      );
    } else {
      await store.addCategory(
        categoryForm.name,
        categoryForm.colorCode,
        categoryForm.icon,
        categoryForm.type
      );
    }
    showCategoryModal.value = false;
  } catch (error) {
    console.error("Failed to save category:", error);
  }
}

async function saveAccountType(accountTypeForm: AccountType) {

  const accountType = toRaw(accountTypeForm);

  if (!accountType.type.trim()) return;

  try {
    if (editingAccountType.value) {
      await store.editAccountType(
        accountType
      );

    } else {
      await store.addAccountType(
        accountType,
      );
    }
    showAccountTypeModal.value = false;
  } catch (error) {
    console.error("Failed to save category:", error);
  }
}

// Close modal
function closeCategoryModal() {
  showCategoryModal.value = false;
  editingCategory.value = false;
}

// Close modal
function closeAccountTypeModal() {
  showAccountTypeModal.value = false;
  editingAccountType.value = false;
}

// Categorization rules
function openRuleCreateModal() {
  editingRule.value = false;
  ruleForm.value = {
    id: 0,
    pattern: "",
    matchType: "contains",
    categoryId: 0,
    priority: store.categorizationRules.length,
    isActive: true,
  };
  showRuleModal.value = true;
}

function openRuleEditModal(rule: CategorizationRule) {
  editingRule.value = true;
  ruleForm.value = { ...rule };
  showRuleModal.value = true;
}

async function saveRule(form: CategorizationRule) {
  if (!form.pattern.trim() || form.categoryId === 0) return;

  try {
    await store.saveCategorizationRule({
      ...toRaw(form),
      id: editingRule.value ? form.id : undefined,
    });
    showRuleModal.value = false;
  } catch (error) {
    console.error("Failed to save rule:", error);
  }
}

function closeRuleModal() {
  showRuleModal.value = false;
  editingRule.value = false;
}

async function deleteRule(id: number) {
  if (
    await confirmModal.value?.openConfirmation({
      title: "Delete Rule",
      message: "Are you sure you want to delete this rule?",
      cancelText: "Cancel",
      confirmText: "Delete",
    })
  ) {
    await store.removeCategorizationRule(id);
  }
}

async function toggleRuleActive(rule: CategorizationRule) {
  await store.saveCategorizationRule({ ...toRaw(rule), isActive: !rule.isActive });
}

async function moveRule(index: number, delta: number) {
  const target = index + delta;
  if (target < 0 || target >= store.categorizationRules.length) return;
  const ids = store.categorizationRules.map((r) => r.id);
  [ids[index], ids[target]] = [ids[target], ids[index]];
  await store.reorderCategorizationRules(ids);
}

</script>

<template>
  <div class="space-y-6 overflow-y-auto h-full pr-2 pb-6">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Categories
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ store.categories.length }} categories
        </p>
      </div>

      <button
        class="inline-flex items-center px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg font-medium transition-colors"
        @click="openCategoryCreateModal"
      >
        <i class="pi pi-plus mr-2" />
        Add Category
      </button>
    </div>

    <!-- Categories Grid -->
    <div
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
    >
      <div
        v-for="category in store.categories"
        :key="category.id"
        class="group card p-4 hover:shadow-md transition-shadow"
      >
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3">
            <div
              class="w-12 h-12 rounded-xl flex items-center justify-center text-white"
              :style="{ backgroundColor: category.colorCode }"
            >
              <i :class="['pi text-xl', category.icon]" />
            </div>
            <div>
              <p class="font-semibold text-gray-900 dark:text-white inline-flex items-center gap-1.5">
                {{ category.name }}
                <i
                  v-if="isProtectedCategoryName(category.name)"
                  class="pi pi-lock text-xs text-gray-400 dark:text-gray-500"
                  title="Default category — can't be renamed or deleted"
                />
              </p>
              <p class="text-sm text-gray-500 dark:text-gray-400">
                {{ category.colorCode }}
              </p>
            </div>
          </div>

          <!-- Actions -->
          <div class="hidden group-hover:flex items-center space-x-1">
            <button
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary-500 transition-colors"
              title="Edit"
              @click="openCategoryEditModal(category)"
            >
              <i class="pi pi-pencil text-sm" />
            </button>
            <button
              v-if="!isProtectedCategoryName(category.name)"
              class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-expense transition-colors"
              title="Delete"
              @click="deleteCategory(category.id)"
            >
              <i class="pi pi-trash text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>

    
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Account Types
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ store.accountTypes.length }} account types
        </p>
      </div>

      <button
        class="inline-flex items-center px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg font-medium transition-colors"
        @click="openAccountTypeCreateModal"
      >
        <i class="pi pi-plus mr-2" />
        Add Account Type
      </button>
    </div>

    <div
      class="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4"
    >
      <div
        v-for="accountType in store.accountTypes"
        :key="accountType.id"
        class="group card p-1 hover:shadow-md transition-shadow"
      >
        <div class="flex items-center justify-between gap-1 h-full min-w-0">
          <div class="flex items-center gap-1.5 min-w-0 flex-1 pl-3 py-2">
            <p class="font-semibold text-gray-900 dark:text-white truncate">
              {{ accountType.type }}
            </p>
            <i
              v-if="isProtectedAccountTypeName(accountType.type)"
              class="pi pi-lock text-xs text-gray-400 dark:text-gray-500 shrink-0"
              title="Default account type — can't be renamed or deleted"
            />
          </div>

          <!-- Actions -->
          <div class="hidden group-hover:flex items-center space-x-1 shrink-0 pr-1">
            <button
              class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary-500 transition-colors"
              title="Edit"
              @click="openAccountTypeEditModal(accountType)"
            >
              <i class="pi pi-pencil text-sm" />
            </button>
            <button
              v-if="!isProtectedAccountTypeName(accountType.type)"
              class="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-expense transition-colors"
              title="Delete"
              @click="deleteAccountType(accountType.id)"
            >
              <i class="pi pi-trash text-sm" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Auto-Categorization Rules -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">
          Auto-Categorization Rules
        </h2>
        <p class="text-sm text-gray-500 dark:text-gray-400">
          {{ store.categorizationRules.length }} rules — applied top to bottom
        </p>
      </div>

      <button
        class="inline-flex items-center px-4 py-2 bg-primary-500 dark:bg-primary-900/40 text-white dark:text-primary-300 hover:bg-primary-600 dark:hover:bg-primary-900/60 rounded-lg font-medium transition-colors"
        @click="openRuleCreateModal"
      >
        <i class="pi pi-plus mr-2" />
        Add Rule
      </button>
    </div>

    <!-- Rules list (single column — order is the priority) -->
    <div
      v-if="store.categorizationRules.length > 0"
      class="space-y-2"
    >
      <div
        v-for="(rule, index) in store.categorizationRules"
        :key="rule.id"
        class="group card px-4 py-3 hover:shadow-md transition-shadow flex items-center gap-3"
        :class="{ 'opacity-60': !rule.isActive }"
      >
        <span class="w-6 text-sm text-gray-400 dark:text-gray-500 text-right shrink-0">
          {{ index + 1 }}
        </span>

        <!-- Reorder -->
        <div class="flex flex-col shrink-0">
          <button
            :disabled="index === 0"
            class="p-0.5 rounded text-gray-400 hover:text-primary-500 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
            title="Move up"
            @click="moveRule(index, -1)"
          >
            <i class="pi pi-chevron-up text-xs" />
          </button>
          <button
            :disabled="index === store.categorizationRules.length - 1"
            class="p-0.5 rounded text-gray-400 hover:text-primary-500 disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
            title="Move down"
            @click="moveRule(index, 1)"
          >
            <i class="pi pi-chevron-down text-xs" />
          </button>
        </div>

        <!-- Rule description -->
        <div class="flex items-center gap-2 min-w-0 flex-1">
          <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 shrink-0">
            {{ matchTypeLabels[rule.matchType] }}
          </span>
          <span class="font-medium text-gray-900 dark:text-white truncate">
            "{{ rule.pattern }}"
          </span>
          <i class="pi pi-arrow-right text-xs text-gray-400 shrink-0" />
          <template v-if="ruleCategory(rule)">
            <div
              class="w-6 h-6 rounded-md flex items-center justify-center text-white shrink-0"
              :style="{ backgroundColor: ruleCategory(rule)!.colorCode }"
            >
              <i :class="['pi text-xs', ruleCategory(rule)!.icon]" />
            </div>
            <span class="text-sm text-gray-700 dark:text-gray-300 truncate">
              {{ ruleCategory(rule)!.name }}
            </span>
          </template>
        </div>

        <!-- Actions -->
        <div class="hidden group-hover:flex items-center space-x-1 shrink-0">
          <button
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-primary-500 transition-colors"
            title="Edit"
            @click="openRuleEditModal(rule)"
          >
            <i class="pi pi-pencil text-sm" />
          </button>
          <button
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-expense transition-colors"
            title="Delete"
            @click="deleteRule(rule.id)"
          >
            <i class="pi pi-trash text-sm" />
          </button>
        </div>

        <!-- Active toggle -->
        <button
          type="button"
          role="switch"
          :aria-checked="!!rule.isActive"
          class="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
          :class="rule.isActive ? 'bg-primary-500 dark:bg-primary-500/30' : 'bg-gray-200 dark:bg-gray-700'"
          :title="rule.isActive ? 'Active' : 'Inactive'"
          @click="toggleRuleActive(rule)"
        >
          <span
            class="inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform"
            :class="rule.isActive ? 'translate-x-5' : 'translate-x-1'"
          />
        </button>
      </div>
    </div>
    <p
      v-else
      class="text-sm text-gray-400 dark:text-gray-500"
    >
      No rules yet — rules suggest a category from the transaction title as you type.
    </p>

    <!-- Empty State -->
    <div
      v-if="store.categories.length === 0"
      class="text-center py-12"
    >
      <i class="pi pi-tags text-5xl text-gray-300 dark:text-gray-600 mb-4" />
      <p class="text-lg text-gray-500 dark:text-gray-400">
        No categories yet
      </p>
      <p class="text-sm text-gray-400 dark:text-gray-500 mt-1">
        Create categories to organize your transactions
      </p>
    </div>    
  </div>

  <CategoryModal
    v-if="showCategoryModal"
    :editing-category="categoryForm"
    :name-locked="isProtectedCategoryName(categoryForm.name)"
    @close-category-modal="closeCategoryModal"
    @save-category="saveCategory"
  />
  <AccountTypeModal
    v-if="showAccountTypeModal"
    :editing-account-type="accountTypeForm"
    :name-locked="isProtectedAccountTypeName(accountTypeForm.type)"
    @close-account-type-modal="closeAccountTypeModal"
    @save-account-type="saveAccountType"
  />
  <RuleModal
    v-if="showRuleModal"
    :editing-rule="ruleForm"
    @close-rule-modal="closeRuleModal"
    @save-rule="saveRule"
  />

  <ConfirmationModal ref="confirmModal" />
  <ErrorModal ref="errorModal" />
</template>
